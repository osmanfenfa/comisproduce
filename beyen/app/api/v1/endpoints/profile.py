"""
Profile photo for every account (admin, station staff, farmers, traders).
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import get_current_user
from app.core.rate_limit import limiter, too_many_requests
from app.models.user import User, UserStatus
from app.services.avatars import avatar_url
from app.services.media_storage import storage, MediaRejected

router = APIRouter()


def _me(db: Session, current: dict) -> User:
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user or user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Account is not active.")
    return user


@router.get("/photo")
def get_photo(db: Session = Depends(get_db), current=Depends(get_current_user)):
    return {"avatar_url": avatar_url(_me(db, current))}


@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), db: Session = Depends(get_db),
                       current=Depends(get_current_user)):
    user = _me(db, current)
    if limiter.check_and_hit(f"avatar:{user.id}", 10, 60 * 60):
        raise too_many_requests(60 * 60)
    try:
        stored = await storage.save(file, f"avatars/{user.id}", allow_video=False)
    except MediaRejected as e:
        raise HTTPException(status_code=400, detail=str(e))
    old = user.avatar_path
    user.avatar_path = stored.path
    db.commit()
    if old:
        storage.delete(old)
    return {"avatar_url": avatar_url(user)}


@router.delete("/photo")
def remove_photo(db: Session = Depends(get_db), current=Depends(get_current_user)):
    user = _me(db, current)
    old = user.avatar_path
    user.avatar_path = None
    db.commit()
    if old:
        storage.delete(old)
    return {"avatar_url": None}
