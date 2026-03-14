# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies first (cache layer)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build


# ── Stage 2: Python backend + serve built frontend ────────────────────────
FROM python:3.11-slim

# System deps for pymongo, pandas, etc.
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python source
COPY main.py sample_portfolio.json ./
COPY api/ api/
COPY agents/ agents/
COPY core/ core/
COPY utils/ utils/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend/dist frontend/dist

# HF Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

# Run with uvicorn — no reload in production
CMD ["python", "main.py"]
