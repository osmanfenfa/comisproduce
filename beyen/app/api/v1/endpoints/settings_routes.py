"""
App settings management. (spec sections 2.1, 2.2, 15)

Each company has its own settings row (prices, station name).
Manager: reads/updates their own company's row. Cannot change standard_moisture_percent.
Admin: reads/updates the global row — the platform-wide standard_moisture_percent
       and the defaults new companies start with.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.settings_model import AppSettings
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.audit import log_action
from app.services.settings_service import get_global_settings, get_tenant_settings, tenant_id_of

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)


def _row_for(db: Session, current: dict) -> AppSettings:
    if current["role"] == UserRole.system_admin.value:
        return get_global_settings(db)
    return get_tenant_settings(db, tenant_id_of(current))


def _to_out(row: AppSettings, db: Session) -> SettingsOut:
    out = SettingsOut.model_validate(row)
    out.standard_moisture_percent = get_global_settings(db).standard_moisture_percent
    return out


@router.get("/", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), current=Depends(MANAGER_OR_ADMIN)):
    return _to_out(_row_for(db, current), db)


@router.put("/", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    is_admin = current["role"] == UserRole.system_admin.value

    if not is_admin and payload.standard_moisture_percent is not None:
        raise HTTPException(
            status_code=403,
            detail="Only a System Admin can change the standard moisture percentage.",
        )

    row = _row_for(db, current)
    old_snap = {
        "station_name": row.station_name,
        "standard_moisture_percent": row.standard_moisture_percent,
        "cocoa_price_per_kg": row.cocoa_price_per_kg,
        "coffee_price_per_kg": row.coffee_price_per_kg,
        "cola_price_per_kg": row.cola_price_per_kg,
    }

    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in update_data.items():
        setattr(row, field, value)

    log_action(db, current["id"], current["role"], "update_settings", "AppSettings",
               None, old_value=old_snap, new_value=update_data, commit=False)
    db.commit()
    db.refresh(row)
    return _to_out(row, db)
