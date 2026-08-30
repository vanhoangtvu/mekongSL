"""
Main entry point — FastAPI app cho Mekong AI Microservice.
"""
import os
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env trước mọi import khác
load_dotenv(Path(__file__).parent / ".env")

# Đảm bảo thư mục gốc trong sys.path để import llm_router, models, ...
sys.path.insert(0, str(Path(__file__).parent))

from llm_router import init_llm_router
from api.routes import router

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── FastAPI App ───────────────────────────────────────────────────
app = FastAPI(
    title="Mekong AI Microservice",
    description="Hệ thống phân tích dữ liệu GIS Mekong Delta — AI data-driven, không bịa số liệu",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3004",
        "http://localhost:3000",
        "http://103.54.251.212:3004",
        os.getenv("CORS_EXTRA_ORIGIN", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────
app.include_router(router)


# ── Startup ──────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("  Mekong AI Microservice — Khởi động")
    logger.info("=" * 60)
    try:
        init_llm_router()
        logger.info("✓ LLM Router (Groq key rotation) sẵn sàng")
    except ValueError as e:
        logger.error(f"✗ LLM Router lỗi: {e}")
        logger.error("  → Hãy cấu hình GROQ_KEY_1, GROQ_KEY_2, ... trong .env")
    logger.info("✓ Session store (in-memory) sẵn sàng")
    logger.info(f"✓ Service chạy trên port {os.getenv('AI_SERVICE_PORT', 8090)}")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Mekong AI Microservice đang tắt...")


# ── Run ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("AI_SERVICE_HOST", "0.0.0.0"),
        port=int(os.getenv("AI_SERVICE_PORT", 8090)),
        reload=False,
        log_level="info",
    )
