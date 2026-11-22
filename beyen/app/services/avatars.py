"""Profile photo URL for any user (Cloudinary URL or local /media path)."""
from app.services.media_storage import storage


def avatar_url(user) -> str | None:
    path = getattr(user, "avatar_path", None)
    if not path:
        return None
    url = storage.url(path)
    # Small square crop for avatars when served by Cloudinary
    return url.replace("/upload/f_auto,q_auto,c_limit,w_1600/", "/upload/f_auto,q_auto,c_fill,g_face,w_256,h_256/")
