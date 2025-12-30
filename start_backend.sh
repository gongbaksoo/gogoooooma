#!/bin/bash

# Start Backend with SSL
cd "$(dirname "$0")/api"

# Activate virtual environment
source venv/bin/activate

# Start uvicorn with SSL
python3 -m uvicorn index:app \
    --host 0.0.0.0 \
    --port 8000 \
    --ssl-keyfile /etc/letsencrypt/live/api.gongbaksoo.com/privkey.pem \
    --ssl-certfile /etc/letsencrypt/live/api.gongbaksoo.com/fullchain.pem \
    --reload
