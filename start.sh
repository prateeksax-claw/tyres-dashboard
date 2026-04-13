#!/bin/bash
# AZ Tyres Dashboard — Start Script
# Usage: ./start.sh [dev|prod|build|restart|stop]
set -e

PORT=8770

echo "============================================"
echo "  AZ Tyres Dashboard"
echo "  http://127.0.0.1:$PORT"
echo "============================================"

cd "$(dirname "$0")"

# Check .env
if [ ! -f .env ]; then
    echo "  .env not found — copying from .env.example"
    cp .env.example .env
fi

# Check data
source .env 2>/dev/null
DATA_DIR="${DATA_DIR:-./data}"
if [ -f "$DATA_DIR/tyres-mirror.db" ]; then
    echo "  tyres-mirror.db: $(du -h "$DATA_DIR/tyres-mirror.db" | cut -f1)"
else
    echo "  WARNING: tyres-mirror.db not found in $DATA_DIR"
fi

echo ""

MODE="${1:-dev}"

stop_backend() {
    # Kill any existing backend on our port
    PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo "  Stopping existing backend (PID $PID)..."
        kill "$PID" 2>/dev/null || true
        sleep 1
    fi
}

case "$MODE" in
    dev)
        echo "Starting dev mode..."
        stop_backend
        pip3 install -r backend/requirements.txt -q 2>/dev/null
        python3 -m uvicorn backend.main:app --host 127.0.0.1 --port $PORT --reload &
        BACKEND_PID=$!

        cd frontend
        npm install -q 2>/dev/null
        npm run dev &
        FRONTEND_PID=$!
        cd ..

        echo ""
        echo "  Backend PID:  $BACKEND_PID (port $PORT)"
        echo "  Frontend PID: $FRONTEND_PID (port 3202)"
        echo "  Press Ctrl+C to stop"
        wait
        ;;

    prod)
        echo "Starting production mode..."
        stop_backend
        echo "  Building frontend..."
        cd frontend && npm ci && npm run build && cd ..
        echo "  Starting backend (serves built frontend)..."
        exec python3 -m uvicorn backend.main:app --host 127.0.0.1 --port $PORT
        ;;

    build)
        echo "Building frontend only..."
        cd frontend && npm ci && npm run build && cd ..
        echo ""
        echo "  Done. Start with: ./start.sh prod"
        ;;

    restart)
        echo "Restarting..."
        stop_backend
        echo "  Starting backend..."
        nohup python3 -m uvicorn backend.main:app --host 127.0.0.1 --port $PORT > /tmp/tyres-dashboard.log 2>&1 &
        sleep 2
        if curl -sf http://127.0.0.1:$PORT/api/health > /dev/null; then
            echo "  Backend healthy (PID $!)"
        else
            echo "  WARNING: Backend may not be ready yet"
            echo "  Check: tail -f /tmp/tyres-dashboard.log"
        fi
        ;;

    stop)
        stop_backend
        echo "  Stopped."
        ;;

    *)
        echo "Usage: ./start.sh [dev|prod|build|restart|stop]"
        echo ""
        echo "  dev     — Backend (reload) + frontend dev servers"
        echo "  prod    — Build frontend, start backend in foreground"
        echo "  build   — Build frontend only"
        echo "  restart — Stop old + start backend in background"
        echo "  stop    — Stop backend"
        ;;
esac
