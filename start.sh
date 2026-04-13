#!/bin/bash
# Tyres Dashboard — Start Script
set -e

echo "============================================"
echo "  AZ Tyres Dashboard"
echo "  Backend:  http://127.0.0.1:8770"
echo "============================================"

cd "$(dirname "$0")"

# Check .env
if [ ! -f .env ]; then
    echo "  .env file not found — copying from .env.example"
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

case "$MODE" in
    dev)
        echo "Starting dev mode..."
        # Backend
        pip3 install -r backend/requirements.txt -q 2>/dev/null
        python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8770 --reload &
        BACKEND_PID=$!

        # Frontend
        cd frontend
        npm install -q 2>/dev/null
        npm run dev &
        FRONTEND_PID=$!
        cd ..

        echo ""
        echo "  Backend PID:  $BACKEND_PID (port 8770)"
        echo "  Frontend PID: $FRONTEND_PID (port 3202)"
        echo "  Press Ctrl+C to stop"
        wait
        ;;

    prod)
        echo "Starting production mode..."
        echo "  Building frontend..."
        cd frontend && npm ci && npm run build && cd ..
        echo "  Starting backend (serves built frontend)..."
        python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8770
        ;;

    build)
        echo "Building frontend only..."
        cd frontend && npm ci && npm run build && cd ..
        echo "  Done. Run with: python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8770"
        ;;

    *)
        echo "Usage: ./start.sh [dev|prod|build]"
        echo ""
        echo "  dev   — Start backend + frontend dev servers"
        echo "  prod  — Build frontend, start backend serving dist/"
        echo "  build — Build frontend only"
        ;;
esac
