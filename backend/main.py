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

    # Close old connection if DB was updated (nightly sync)
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
    _get_duckdb_con()  # pre-warm connection
    yield
    logger.info("Tyres Dashboard stopped.")

app = FastAPI(title="Tyres Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    db_ok = TYRES_DB.exists()
    return {
        "status": "ok" if db_ok else "degraded",
        "tyres_db": str(TYRES_DB),
        "tyres_db_exists": db_ok,
        "tyres_db_size_mb": round(TYRES_DB.stat().st_size / 1048576, 1) if db_ok else 0,
    }


# ══════════════════════════════════════════════════════════════════════════════
# TYRES SUMMARY — the core endpoint
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/tyres/summary")
def tyres_summary(month: Optional[str] = None):
    """MTD salesman performance + monthly trend from tyres-mirror.db via DuckDB."""
    try:
        month = month or _default_month()
        month_start, month_end = _month_bounds(month)

        # ── Salesmen MTD ──────────────────────────────────────────────
        rows_sm, _ = _query(f"""
            SELECT SalesMan,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   COUNT(DISTINCT Customer) as customers,
                   COUNT(DISTINCT CAST(InvoiceDate AS DATE)) as active_days
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
            salesmen.append({
                "SalesMan": r[0],
                "Revenue": round(rev),
                "Margin": round(margin),
                "GP_Pct": round(margin / rev * 100, 1) if rev > 0 else 0,
                "Customers": r[3] or 0,
                "ActiveDays": r[4] or 0,
            })

        # ── Monthly trend (last 6 months) ─────────────────────────────
        rows_trend, _ = _query(f"""
            SELECT STRFTIME(CAST(InvoiceDate AS DATE), '%Y-%m') as month,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= STRFTIME(CURRENT_DATE - INTERVAL '6 months', '%Y-%m-%d')
            GROUP BY month ORDER BY month
        """)
        trend = [{"month": r[0], "revenue": round(r[1] or 0), "margin": round(r[2] or 0)} for r in rows_trend]

        # ── Daily breakdown for current month ─────────────────────────
        rows_daily, _ = _query(f"""
            SELECT CAST(InvoiceDate AS DATE) as day,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   COUNT(DISTINCT Customer) as customers,
                   COUNT(DISTINCT SalesMan) as salesmen
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY day ORDER BY day
        """, [month_start, month_end])
        daily_chart = [{"date": str(r[0]), "revenue": round(r[1] or 0), "customers": r[2] or 0} for r in rows_daily]

        # ── Brands ────────────────────────────────────────────────────
        rows_brands, _ = _query(f"""
            SELECT COALESCE(Brand, 'Unknown') as brand,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY brand
            ORDER BY revenue DESC
        """, [month_start, month_end])
        brands = []
        for r in rows_brands:
            rev = r[1] or 0
            margin = r[2] or 0
            brands.append({
                "brand": r[0],
                "revenue": round(rev),
                "gp_pct": round(margin / rev * 100, 1) if rev > 0 else 0,
            })

        # ── Customers ─────────────────────────────────────────────────
        rows_cust, _ = _query(f"""
            SELECT Customer,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin,
                   COUNT(*) as invoices
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND InvoiceDate >= ? AND InvoiceDate < ?
            GROUP BY Customer
            ORDER BY revenue DESC
            LIMIT 50
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
            })

        # ── Totals ────────────────────────────────────────────────────
        total_rev = sum(s["Revenue"] for s in salesmen)
        total_margin = sum(s["Margin"] for s in salesmen)
        total_gp = (total_margin / total_rev * 100) if total_rev > 0 else 0
        total_customers = sum(s["Customers"] for s in salesmen)

        y, m = int(month[:4]), int(month[5:7])
        days_in_month = monthrange(y, m)[1]
        today = datetime.now()
        days_elapsed = min(today.day, days_in_month) if today.year == y and today.month == m else days_in_month
        projected = (total_rev / days_elapsed * days_in_month) if days_elapsed > 0 else 0

        return {
            "salesmen": salesmen,
            "total_revenue": round(total_rev),
            "total_margin": round(total_margin),
            "total_gp_pct": round(total_gp, 1),
            "monthly_target": MONTHLY_TARGET,
            "monthly_trend": trend,
            "daily_chart": daily_chart,
            "top_brands": brands[:10],
            "customers": customers,
            "kpis": {
                "revenue": round(total_rev),
                "gp_pct": round(total_gp, 1),
                "projected_revenue": round(projected),
                "units_sold": 0,
                "avg_selling_price": 0,
                "days_elapsed": days_elapsed,
                "days_in_month": days_in_month,
                "customers": total_customers,
                "invoices": 0,
            },
            "months_available": _months_available(),
            "month": month,
            "error": None,
        }
    except Exception as e:
        logger.error(f"Tyres summary error: {e}")
        return {"salesmen": [], "total_revenue": 0, "monthly_trend": [], "error": str(e)}


# ══════════════════════════════════════════════════════════════════════════════
# OVERVIEW — richer endpoint for the React dashboard
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/api/overview")
def overview(month: Optional[str] = None):
    """Full overview — wraps tyres_summary with extra KPI shaping."""
    data = cached(f"summary_{month or _default_month()}", lambda: tyres_summary(month))
    return data


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
        # Monthly trend for this salesman
        rows, _ = _query(f"""
            SELECT STRFTIME(CAST(InvoiceDate AS DATE), '%Y-%m') as month,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND SalesMan = ?
              AND InvoiceDate >= STRFTIME(CURRENT_DATE - INTERVAL '{months} months', '%Y-%m-%d')
            GROUP BY month ORDER BY month
        """, [name])
        trend_months = [{"month": r[0], "revenue": round(r[1] or 0)} for r in rows]

        # Top customers for this salesman (current month)
        month = _default_month()
        ms, me = _month_bounds(month)
        rows_c, _ = _query(f"""
            SELECT Customer,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin
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
            })

        return {
            "performance": {},
            "customers": {"customers": customers},
            "categories": {},
            "trend": {"salesmen": [{"name": name, "months": trend_months}]},
            "month": month,
        }
    except Exception as e:
        logger.error(f"Salesman detail error: {e}")
        return {"performance": {}, "customers": {"customers": []}, "trend": {"salesmen": []}}


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
    try:
        # Monthly trend for this customer
        rows, _ = _query(f"""
            SELECT STRFTIME(CAST(InvoiceDate AS DATE), '%Y-%m') as month,
                   ROUND(SUM(NetAmountWithoutVAT)) as revenue,
                   ROUND(SUM(CASE WHEN LastPurchaseRate > 0
                       THEN NetAmountWithoutVAT - (LastPurchaseRate * Quantity)
                       ELSE 0 END)) as margin
            FROM tyres.sales
            WHERE {TYRES_WHERE}
              AND Customer = ?
              AND InvoiceDate >= STRFTIME(CURRENT_DATE - INTERVAL '6 months', '%Y-%m-%d')
            GROUP BY month ORDER BY month
        """, [name])
        trend = [{"month": r[0], "revenue": round(r[1] or 0), "gp_pct": round((r[2] or 0) / (r[1] or 1) * 100, 1)} for r in rows]

        return {"customer": name, "products": [], "trend": trend, "month": month}
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
        "categories": [],
        "products": [],
        "brands": data.get("top_brands", []),
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
