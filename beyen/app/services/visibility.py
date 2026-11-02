"""
Who can see and act on which purchase.

Station workflow:
  - A Secretary records purchases, approves them and issues receipts during the day.
    These stay private to the station (synced_at IS NULL).
  - At the end of the day the Secretary reviews and syncs (POST /sync/). From then on
    the Manager sees them, and only the Manager can change them.
  - Purchases recorded by the Manager are visible to the Manager immediately.
"""
import uuid
from datetime import datetime
from fastapi import HTTPException
from app.models.user import UserRole


def tenant_id_of(current: dict) -> uuid.UUID:
    return current.get("produce_id") or current["id"]


def is_secretary(current: dict) -> bool:
    return current["role"] == UserRole.produce_secretary.value


def is_admin(current: dict) -> bool:
    return current["role"] == UserRole.system_admin.value


def synced_at_on_create(current: dict) -> datetime | None:
    """Manager/Admin purchases are visible to the Manager straight away."""
    return None if is_secretary(current) else datetime.utcnow()


def _secretary_owns(txn, current: dict) -> bool:
    station = current.get("station_name")
    return txn.created_by == current["id"] or (bool(station) and txn.station_name == station)


def scope_query(query, model, current: dict):
    """Filter a transaction (or Receipt) query down to what `current` may see."""
    if not is_admin(current):
        query = query.filter(model.produce_id == tenant_id_of(current))
    if is_secretary(current):
        if hasattr(model, "created_by"):
            station = current.get("station_name")
            if station:
                query = query.filter((model.station_name == station) | (model.created_by == current["id"]))
            else:
                query = query.filter(model.created_by == current["id"])
        else:  # Receipt: this station's receipts, or ones this secretary recorded/issued
            station = current.get("station_name")
            mine = (model.recorded_by == current["id"]) | (model.issued_by == current["id"])
            query = query.filter((model.station_name == station) | mine if station else mine)
    else:
        query = query.filter(model.synced_at.isnot(None))
    return query


def can_see(txn, current: dict) -> bool:
    if not is_admin(current) and txn.produce_id and txn.produce_id != tenant_id_of(current):
        return False
    if is_secretary(current):
        return _secretary_owns(txn, current)
    return txn.synced_at is not None


def ensure_visible(txn, current: dict) -> None:
    """404 when missing or not yet synced (for the Manager); 403 for another business."""
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not is_admin(current) and txn.produce_id and txn.produce_id != tenant_id_of(current):
        raise HTTPException(status_code=403, detail="Access denied")
    if not can_see(txn, current):
        if is_secretary(current):
            raise HTTPException(status_code=403, detail="Access denied")
        raise HTTPException(status_code=404, detail="Transaction not found")


def ensure_can_review(txn, current: dict) -> None:
    """Approve / reject / issue receipt."""
    ensure_visible(txn, current)
    if is_secretary(current) and txn.synced_at is not None:
        raise HTTPException(
            status_code=403,
            detail="This purchase has already been synced to the Manager; only the Manager can change it now.",
        )
