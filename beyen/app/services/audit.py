"""Every significant action writes one row here. Called from endpoint handlers."""
import json
import uuid
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_action(db: Session, user_id: uuid.UUID, user_role: str, action: str,
                entity_type: str, entity_id: uuid.UUID | None = None,
                old_value: dict | None = None, new_value: dict | None = None,
                produce_id: uuid.UUID | None = None, commit: bool = True):
    """Pass commit=False to write the log row inside the caller's transaction,
    so the action and its audit entry are saved (or rolled back) together."""
    if not produce_id and user_id:
        from app.models.user import User
        u = db.query(User.produce_id).filter(User.id == user_id).first()
        if u and u[0]:
            produce_id = u[0]

    entry = AuditLog(
        user_id=user_id,
        user_role=user_role,
        produce_id=produce_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=json.dumps(old_value, default=str) if old_value else None,
        new_value=json.dumps(new_value, default=str) if new_value else None,
    )
    db.add(entry)
    if commit:
        db.commit()
