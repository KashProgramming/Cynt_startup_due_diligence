"""
Entrypoint — starts the FastAPI server.
Run: python main.py  OR  uvicorn main:app --reload
"""
import uvicorn
from api.gateway import app

if __name__ == "__main__":
    uvicorn.run("api.gateway:app", host="0.0.0.0", port=8000, reload=True)
