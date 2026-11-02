from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, users, sellers, cocoa, coffee, cola, sync, payouts,
    loans, dashboard, settings_routes,
    receipts, audit_logs, reports, supplies,
)

api_router = APIRouter()
api_router.include_router(auth.router,             prefix="/auth",        tags=["Auth"])
api_router.include_router(users.router,            prefix="/users",       tags=["Users"])
api_router.include_router(sellers.router,          prefix="/sellers",     tags=["Sellers"])
api_router.include_router(cocoa.router,            prefix="/cocoa",       tags=["Cocoa"])
api_router.include_router(coffee.router,           prefix="/coffee",      tags=["Coffee"])
api_router.include_router(cola.router,             prefix="/cola",        tags=["Cola"])
api_router.include_router(sync.router,             prefix="/sync",        tags=["Station Sync"])
api_router.include_router(payouts.router,          prefix="/payouts",     tags=["Payouts (placeholder)"])
api_router.include_router(loans.router,            prefix="/loans",       tags=["Loans"])
api_router.include_router(receipts.router,         prefix="/receipts",    tags=["Receipts"])
api_router.include_router(dashboard.router,        prefix="/dashboard",   tags=["Dashboard"])
api_router.include_router(settings_routes.router,  prefix="/settings",    tags=["Settings"])
api_router.include_router(audit_logs.router,       prefix="/audit-logs",  tags=["Audit Logs"])
api_router.include_router(reports.router,          prefix="/reports",     tags=["Reports"])
api_router.include_router(supplies.router,         prefix="/supplies",    tags=["Supplies"])
