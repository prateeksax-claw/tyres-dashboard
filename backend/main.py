"""
Al Zaabi Tyres Dashboard — Self-contained FastAPI Backend
Queries tyres-mirror.db via DuckDB. No external script dependencies.
"""
import os
import logging
import threading
import time as _time
from datetime import datetime, date
from pathlib import Path
from calendar import monthrange
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

import duckdb as _duckdb

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("tyres-dashboard")

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA_DIR = Path(os.environ.get("DATA_DIR", "/home/ubuntu/tyres-dashboard/data"))
TYRES_DB = DATA_DIR / "tyres-mirror.db"

# ── DuckDB Connection (persistent, thread-safe) ──────────────────────────────
_duckdb_con = None
_duckdb_mtime = 0
_duckdb_lock = threading.Lock()


def _get_duckdb_con():
    """Get or create a persistent DuckDB connection with tyres-mirror attached."""
    global _duckdb_con, _duckdb_mtime

    try:
        current_mtime = TYRES_DB.stat().st_mtime
    except Exception:
        current_mtime = 0

    if _duckdb_con is not None and current_mtime == _duckdb_mtime:
        return _duckdb_con

    if _duckdb_con is not None:
        try:
            _duckdb_con.close()
        except Exception:
            pass
        _duckdb_con = None

    logger.info(f"Initializing DuckDB, attaching {TYRES_DB}...")
    con = _duckdb.connect(":memory:")
    con.execute("INSTALL sqlite; LOAD sqlite;")

    if TYRES_DB.exists():
        con.execute(f"ATTACH '{TYRES_DB}' AS tyres (TYPE sqlite, READ_ONLY);")
        logger.info("Attached tyres-mirror.db")
    else:
        logger.warning(f"tyres-mirror.db not found at {TYRES_DB}")

    _duckdb_con = con
    _duckdb_mtime = current_mtime
    logger.info("DuckDB ready.")
    return _duckdb_con


def _query(sql: str, params: list = None):
    """Run a DuckDB query with auto-reconnect on failure."""
    with _duckdb_lock:
        try:
            con = _get_duckdb_con()
            result = con.execute(sql, params or [])
            rows = result.fetchall()
            cols = [d[0] for d in result.description]
            return rows, cols
        except Exception as e:
            global _duckdb_con, _duckdb_mtime
            logger.warning(f"DuckDB query failed ({e}), reconnecting...")
            try:
                if _duckdb_con:
                    _duckdb_con.close()
            except Exception:
                pass
            _duckdb_con = None
            _duckdb_mtime = 0
            con = _get_duckdb_con()
            result = con.execute(sql, params or [])
            rows = result.fetchall()
            cols = [d[0] for d in result.description]
            return rows, cols


# ── Cache ─────────────────────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 300  # 5 minutes


def cached(key: str, fn, ttl=CACHE_TTL):
    now = _time.time()
    if key in _cache and now - _cache[key]['ts'] < ttl:
        return _cache[key]['data']
    data = fn()
    _cache[key] = {'data': data, 'ts': now}
    return data


# ── Helpers ───────────────────────────────────────────────────────────────────
MONTHLY_TARGET = int(os.environ.get("TYRES_MONTHLY_TARGET", "5925000"))

# Standard WHERE clause for tyres sales
TYRES_WHERE = """
    CompanyType=3 AND IsInterBranch=0 AND TypeValue=1 AND IsInterCompany=0
    AND Customer NOT IN ('LA MASIA GENERAL TRANSPORT','LA MASIA GENER')
"""


def _default_month():
    now = datetime.now()
    return f"{now.year}-{now.month:02d}"


def _prev_month(month: str):
    """Return the month before the given month as 'YYYY-MM'."""
    y, m = int(month[:4]), int(month[5:7])
    m -= 1
    if m <= 0:
        m += 12
        y -= 1
    return f"{y}-{m:02d}"


def _month_bounds(month: str):
    """Returns (month_start, month_end) as 'YYYY-MM-DD' strings."""
    y, m = int(month[:4]), int(month[5:7])
    start = f"{month}-01"
    if m == 12:
        end = f"{y+1}-01-01"
    else:
        end = f"{y}-{m+1:02d}-01"
    return start, end


def _months_available(count=12):
    now = datetime.now()
    months = []
    for i in range(count):
        y, m = now.year, now.month - i
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y}-{m:02d}")
    return months


# ── App ───────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Tyres Dashboard starting...")
    _get_duckdb_con()
    yield
    logger.info("Tyres Dashboard stopped.")

app = FastAPI(title="Tyres Dashboard API", lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tyres.prateeksaxena.net",
        "http://localhost:3202",
        "http://127.0.0.1:3202",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    try:
        db_ok = TYRES_DB.exists()
        size_mb = round(TYRES_DB.stat().st_size / 1048576, 1) if db_ok else 0
        # Test actual DB connectivity
        query_ok = False
        if db_ok:
            try:
                rows, _ = _query("SELECT COUNT(*) FROM tyres.sales LIMIT 1")
                query_ok = rows[0][0] > 0 if rows else False
            except Exception:
                pass
        return {
            "status": "ok" if (db_ok and query_ok) else "degraded",
            "tyres_db": str(TYRES_DB),
            "tyres_db_exists": db_ok,
            "tyres_db_size_mb": size_mb,
            "query_ok": query_ok,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ══════════════════════════════════════════════════════════════════════════════
# TYRES SUMMARY — the core endpoint
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/tyres/summary")
def tyres_summary(month: Optional[str] = None):
    """MTD performance from tyres-mirror.db via DuckDB."""
    try:
        month = month or _default_month()
        month_start, month_end = _month_bounds(month)
        prev_m = _prev_month(month)
        prev_start, prev_end = _month_bounds(prev_m)

        # ── Salesmen MTD ──────────────────────────────────────────────
        rows_sm, _ = _query(f"""
            SELECT SalesMan,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   COUNT(DISTINCT Customer) as customers,
                   COUNT(DISTINCT CAST(InvoiceDate AS DATE)) as active_days,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(*) as invoice_lines
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY SalesMan
            ORDER BY SUM(NetAmountWithoutVAT) DESC
        """, [month_start, month_end])

        salesmen = []
        for r in rows_sm:
            rev = r[1] or 0
            margin = r[2] or 0
            units = r[5] or 0
            salesmen.append({
                "SalesMan": r[0],
                "Revenue": round(rev),
                "Margin": round(margin),
                "GP_Pct": round(margin / rev * 100, 1) if rev > 0 else 0,
                "Customers": r[3] or 0,
                "ActiveDays": r[4] or 0,
                "Units": round(units),
                "Invoices": r[6] or 0,
            })

        # ── Previous month totals (for MoM comparison) ────────────────
        rows_prev, _ = _query(f"""
            SELECT ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   COUNT(DISTINCT Customer) as customers,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(*) as invoices
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
        """, [prev_start, prev_end])
        prev = rows_prev[0] if rows_prev else (0, 0, 0, 0, 0)
        prev_rev = prev[0] or 0
        prev_margin = prev[1] or 0
        prev_customers = prev[2] or 0
        prev_units = prev[3] or 0
        prev_invoices = prev[4] or 0
        prev_gp = (prev_margin / prev_rev * 100) if prev_rev > 0 else 0

        # ── Monthly trend (last 12 months) ────────────────────────────
        rows_trend, _ = _query(f"""
            SELECT STRFTIME(CAST(InvoiceDate AS DATE), '%Y-%m') as month,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(DISTINCT Customer) as customers
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= STRFTIME(CURRENT_DATE - INTERVAL '12 months', '%Y-%m-%d')
            GROUP BY month ORDER BY month
        """)
        trend = [{
            "month": r[0], "revenue": round(r[1] or 0), "margin": round(r[2] or 0),
            "units": round(r[3] or 0), "customers": r[4] or 0,
        } for r in rows_trend]

        # ── Daily breakdown for current month ─────────────────────────
        rows_daily, _ = _query(f"""
            SELECT CAST(InvoiceDate AS DATE) as day,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   COUNT(DISTINCT Customer) as customers,
                   COUNT(DISTINCT SalesMan) as salesmen,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(*) as invoices
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY day ORDER BY day
        """, [month_start, month_end])
        daily_chart = [{
            "date": str(r[0]), "revenue": round(r[1] or 0), "customers": r[2] or 0,
            "units": round(r[4] or 0), "invoices": r[5] or 0,
        } for r in rows_daily]

        # ── Branches (location) ───────────────────────────────────────
        rows_branches, _ = _query(f"""
            SELECT COALESCE(Branch, 'Unknown') as branch,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(DISTINCT Customer) as customers
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY branch
            ORDER BY revenue DESC
        """, [month_start, month_end])
        branches = []
        for r in rows_branches:
            rev = r[1] or 0
            margin = r[2] or 0
            branches.append({
                "branch": r[0],
                "revenue": round(rev),
                "gp_pct": round(margin / rev * 100, 1) if rev > 0 else 0,
                "units": round(r[3] or 0),
                "customers": r[4] or 0,
            })

        # ── Customers ─────────────────────────────────────────────────
        rows_cust, _ = _query(f"""
            SELECT Customer,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   COUNT(*) as invoices,
                   ROUND(SUM(Quantity)) as units,
                   MAX(SalesMan) as salesman
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY Customer
            ORDER BY revenue DESC
            LIMIT 100
        """, [month_start, month_end])
        customers = []
        for r in rows_cust:
            rev = r[1] or 0
            margin = r[2] or 0
            customers.append({
                "customer": r[0],
                "revenue": round(rev),
                "gp_pct": round(margin / rev * 100, 1) if rev > 0 else 0,
                "invoices": r[3] or 0,
                "units": round(r[4] or 0),
                "salesman": r[5] or "",
            })

        # ── Products (top items by revenue) ───────────────────────────
        rows_prod, _ = _query(f"""
            SELECT COALESCE(ItemName, 'Unknown') as product,
                   COALESCE(Branch, '') as branch,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(DISTINCT Customer) as customers
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY product, branch
            ORDER BY revenue DESC
            LIMIT 50
        """, [month_start, month_end])
        products = []
        for r in rows_prod:
            rev = r[2] or 0
            margin = r[3] or 0
            products.append({
                "product": r[0],
                "branch": r[1],
                "revenue": round(rev),
                "gp_pct": round(margin / rev * 100, 1) if rev > 0 else 0,
                "units": round(r[4] or 0),
                "customers": r[5] or 0,
            })

        # ── Totals ────────────────────────────────────────────────────
        total_rev = sum(s["Revenue"] for s in salesmen)
        total_margin = sum(s["Margin"] for s in salesmen)
        total_gp = (total_margin / total_rev * 100) if total_rev > 0 else 0
        total_customers = sum(s["Customers"] for s in salesmen)
        total_units = sum(s["Units"] for s in salesmen)
        total_invoices = sum(s["Invoices"] for s in salesmen)
        avg_price = (total_rev / total_units) if total_units > 0 else 0

        y, m = int(month[:4]), int(month[5:7])
        days_in_month = monthrange(y, m)[1]
        today = datetime.now()
        days_elapsed = min(today.day, days_in_month) if today.year == y and today.month == m else days_in_month
        projected = (total_rev / days_elapsed * days_in_month) if days_elapsed > 0 else 0

        # ── MoM changes ──────────────────────────────────────────────
        def _mom_pct(current, previous):
            if previous and previous > 0:
                return round((current - previous) / previous * 100, 1)
            return None

        mom_revenue = _mom_pct(total_rev, prev_rev)
        mom_gp = round(total_gp - prev_gp, 1) if prev_rev > 0 else None
        mom_customers = _mom_pct(total_customers, prev_customers)
        mom_units = _mom_pct(total_units, prev_units)

        return {
            "salesmen": salesmen,
            "total_revenue": round(total_rev),
            "total_margin": round(total_margin),
            "total_gp_pct": round(total_gp, 1),
            "monthly_target": MONTHLY_TARGET,
            "monthly_trend": trend,
            "daily_chart": daily_chart,
            "branches": branches,
            "customers": customers,
            "products": products,
            "kpis": {
                "revenue": round(total_rev),
                "gp_pct": round(total_gp, 1),
                "projected_revenue": round(projected),
                "units_sold": round(total_units),
                "avg_selling_price": round(avg_price),
                "days_elapsed": days_elapsed,
                "days_in_month": days_in_month,
                "customers": total_customers,
                "invoices": total_invoices,
                "target": MONTHLY_TARGET,
                "achievement_pct": round(total_rev / MONTHLY_TARGET * 100, 1) if MONTHLY_TARGET > 0 else 0,
            },
            "mom": {
                "revenue_pct": mom_revenue,
                "gp_change": mom_gp,
                "customers_pct": mom_customers,
                "units_pct": mom_units,
                "prev_revenue": round(prev_rev),
                "prev_gp_pct": round(prev_gp, 1),
            },
            "months_available": _months_available(),
            "month": month,
            "error": None,
        }
    except Exception as e:
        logger.error(f"Tyres summary error: {e}")
        return {"salesmen": [], "total_revenue": 0, "monthly_trend": [], "error": str(e)}


# ══════════════════════════════════════════════════════════════════════════════
# OVERVIEW — wraps tyres_summary (cached)
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/overview")
def overview(month: Optional[str] = None):
    return cached(f"summary_{month or _default_month()}", lambda: tyres_summary(month))


# ══════════════════════════════════════════════════════════════════════════════
# SALESMEN
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/salesmen")
def salesmen_list(month: Optional[str] = None):
    data = cached(f"summary_{month or _default_month()}", lambda: tyres_summary(month))
    return {"salesmen": data.get("salesmen", []), "month": month or _default_month()}


@app.get("/api/salesman/{name}")
def salesman_detail(name: str, months: int = Query(default=6)):
    """Salesman drill-down: trend + customer breakdown."""
    try:
        rows, _ = _query(f"""
            SELECT STRFTIME(CAST(InvoiceDate AS DATE), '%Y-%m') as month,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(Quantity)) as units
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND SalesMan = ?
              AND InvoiceDate >= STRFTIME(CURRENT_DATE - INTERVAL '{months} months', '%Y-%m-%d')
            GROUP BY month ORDER BY month
        """, [name])
        trend_months = [{"month": r[0], "revenue": round(r[1] or 0), "units": round(r[2] or 0)} for r in rows]

        month = _default_month()
        ms, me = _month_bounds(month)
        rows_c, _ = _query(f"""
            SELECT Customer,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   ROUND(SUM(Quantity)) as units,
                   COUNT(*) as invoices
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND SalesMan = ?
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY Customer
            ORDER BY revenue DESC LIMIT 20
        """, [name, ms, me])
        customers = []
        for r in rows_c:
            rev = r[1] or 0
            margin = r[2] or 0
            customers.append({
                "customer": r[0],
                "revenue": round(rev),
                "gp_pct": round(margin / rev * 100, 1) if rev > 0 else 0,
                "units": round(r[3] or 0),
                "invoices": r[4] or 0,
            })

        return {
            "customers": {"customers": customers},
            "trend": {"salesmen": [{"name": name, "months": trend_months}]},
            "month": month,
        }
    except Exception as e:
        logger.error(f"Salesman detail error: {e}")
        return {"customers": {"customers": []}, "trend": {"salesmen": []}}


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMERS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/customers")
def customers_list(month: Optional[str] = None, search: Optional[str] = None, limit: int = 200):
    data = cached(f"summary_{month or _default_month()}", lambda: tyres_summary(month))
    customers = data.get("customers", [])
    if search:
        customers = [c for c in customers if search.lower() in (c.get("customer", "") or "").lower()]
    return {"customers": customers[:limit], "month": month or _default_month()}


@app.get("/api/customer/{name}")
def customer_detail(name: str, month: Optional[str] = None):
    """Customer drill-down: trend + product breakdown."""
    month = month or _default_month()
    ms, me = _month_bounds(month)
    try:
        # Monthly trend
        rows, _ = _query(f"""
            SELECT STRFTIME(CAST(InvoiceDate AS DATE), '%Y-%m') as month,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   ROUND(SUM(Quantity)) as units
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND Customer = ?
              AND InvoiceDate >= STRFTIME(CURRENT_DATE - INTERVAL '6 months', '%Y-%m-%d')
            GROUP BY month ORDER BY month
        """, [name])
        trend = [{"month": r[0], "revenue": round(r[1] or 0), "gp_pct": round((r[2] or 0) / max(r[1] or 1, 1) * 100, 1), "units": round(r[3] or 0)} for r in rows]

        # Products bought by this customer
        rows_p, _ = _query(f"""
            SELECT COALESCE(ItemName, 'Unknown') as product,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   ROUND(SUM(Quantity)) as units
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND Customer = ?
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY product
            ORDER BY revenue DESC LIMIT 20
        """, [name, ms, me])
        products = []
        for r in rows_p:
            rev = r[1] or 0
            margin = r[2] or 0
            products.append({
                "product": r[0],
                "revenue": round(rev),
                "gp_pct": round(margin / max(rev, 1) * 100, 1),
                "units": round(r[3] or 0),
            })

        return {"customer": name, "products": products, "trend": trend, "month": month}
    except Exception as e:
        logger.error(f"Customer detail error: {e}")
        return {"customer": name, "products": [], "trend": [], "month": month}


# ══════════════════════════════════════════════════════════════════════════════
# PRODUCTS
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/products")
def products_list(month: Optional[str] = None):
    data = cached(f"summary_{month or _default_month()}", lambda: tyres_summary(month))
    return {
        "products": data.get("products", []),
        "branches": data.get("branches", []),
        "total_product_count": len(data.get("products", [])),
        "month": month or _default_month(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# SERVE FRONTEND (built dist/)
# ══════════════════════════════════════════════════════════════════════════════
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """SPA catch-all: serve index.html for all non-API routes."""
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8770)
