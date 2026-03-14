"""
Entrypoint — starts the FastAPI server.
Run locally:  python main.py
In Docker/HF: PORT=7860 python main.py
"""
import os
import uvicorn
from api.gateway import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("PORT") is None  # reload only in local dev
    uvicorn.run("api.gateway:app", host="0.0.0.0", port=port, reload=reload)
