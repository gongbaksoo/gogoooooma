#!/bin/bash

# Kill ports 8000 and 3000 just in case
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Start Backend
echo "Starting Backend..."
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "Starting Frontend..."
cd frontend
npm run dev -- -H 0.0.0.0 -p 3000 &
FRONTEND_PID=$!
cd ..

echo "Services started. Backend: $BACKEND_PID, Frontend: $FRONTEND_PID"
echo "Access Frontend at http://localhost:3000"
echo "Access Backend at http://localhost:8000"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

wait
