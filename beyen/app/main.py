"""
COMIS - Cocoa, Coffee, Cola & (future) Spice Management Information System
FastAPI application entrypoint.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import SessionLocal
from app.db.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema changes are applied by Alembic (python -m app.db.migrate), not here.
    # Startup only makes sure the global settings row / first admin exist.
    if settings.APP_ENV != "testing":
        db = SessionLocal()
        try:
            seed_database(db)
        except Exception as e:
            print(f"[STARTUP] Seeding skipped: {e}. Run `python -m app.db.migrate` to create/upgrade the schema.")
        finally:
            db.close()
    yield


app = FastAPI(
    title="COMIS API",
    version="2.0.0",
    description="Cocoa, Coffee & Cola Management Information System — three-role model",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "COMIS API", "version": "2.0.0"}
