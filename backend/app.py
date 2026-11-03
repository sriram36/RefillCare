from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# Core & Database
from core.config import BASE_DIR, DB, FKEY, SECRET, STORE, AREAS, CORS_ORIGINS
from core.security import (
    auth, check_consent, check_minor_guardian_consent, check_rate_limit,
    need, record_failed_login, reset_failed_login, tok
)
from database.session import db, ensure_schema, ex, log, q, SCHEMA
from database.seed import init, seed_images
from services.catalog import MEDS, match_medicine as match
from services.ocr import DEMOS, demo_png, extract
from services.routing import settle
from services.notifications import notify

# Routers
from routers.auth import router as auth_router
from routers.orders import router as orders_router
from routers.pharmacist import router as pharmacist_router
from routers.store import router as store_router
from routers.refills import router as refills_router
from routers.profiles import router as profiles_router
from routers.dashboard import router as dashboard_router
from routers.subscriptions import router as subscriptions_router

# Create FastAPI application
app = FastAPI(
    title="RefillCare API",
    description="Pharmacy reordering, pharmacist verification, and stock routing platform.",
    version="1.0.0",
)

# OWASP Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Cross-Origin Resource Sharing (CORS) configured via CORS_ORIGINS env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular routers
app.include_router(auth_router)
app.include_router(orders_router)
app.include_router(pharmacist_router)
app.include_router(store_router)
app.include_router(refills_router)
app.include_router(profiles_router)
app.include_router(dashboard_router)
app.include_router(subscriptions_router)


@app.get("/")
def root():
    return {
        "service": "RefillCare API",
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/login",
            "orders": "/api/orders",
            "refills": "/api/refills",
            "subscriptions": "/api/subscriptions",
            "transfers": "/api/transfers",
            "dashboard": "/api/dashboard",
        },
    }


# Auto-initialize database and synthetic seeds on load
init()
seed_images()
