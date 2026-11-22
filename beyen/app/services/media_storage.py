"""
Marketplace media (photos and short videos).

Files are checked by their first bytes, not by the name or type the browser
claims, and stored under MEDIA_ROOT with random names. Served publicly at
MEDIA_URL_PREFIX: listing media is meant to be seen by every market user.

With CLOUDINARY_URL set, new uploads go to Cloudinary (and are delivered resized
and compressed); otherwise they are written to MEDIA_ROOT. Paths stored in the
database are either a local relative path or a full Cloudinary URL, and url()/
delete() handle both, so switching storage never breaks existing files.
"""
import os
import uuid
from dataclasses import dataclass
from fastapi import UploadFile
from app.core.config import settings

MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 30 * 1024 * 1024
_CHUNK = 1024 * 1024


class MediaRejected(ValueError):
    pass


@dataclass
class StoredMedia:
    kind: str           # "photo" | "video"
    path: str           # relative to MEDIA_ROOT, forward slashes
    content_type: str
    size: int


def _sniff(head: bytes) -> tuple[str, str, str] | None:
    """(kind, extension, content_type) from magic bytes, or None if not allowed."""
    if head.startswith(b"\xff\xd8\xff"):
        return "photo", "jpg", "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "photo", "png", "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "photo", "webp", "image/webp"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand == b"qt  ":
            return "video", "mov", "video/quicktime"
        return "video", "mp4", "video/mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "video", "webm", "video/webm"
    return None


class LocalStorage:
    def __init__(self, root: str):
        self.root = root

    async def save(self, upload: UploadFile, folder: str, allow_video: bool = True) -> StoredMedia:
        head = await upload.read(16)
        detected = _sniff(head)
        if not detected or (detected[0] == "video" and not allow_video):
            raise MediaRejected("Only JPG, PNG or WEBP photos and MP4, MOV or WEBM videos are allowed."
                                if allow_video else "Upload a JPG, PNG or WEBP photo.")
        kind, ext, content_type = detected
        limit = MAX_PHOTO_BYTES if kind == "photo" else MAX_VIDEO_BYTES

        rel = f"{folder}/{uuid.uuid4().hex}.{ext}"
        full = os.path.join(self.root, *rel.split("/"))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        size = len(head)
        try:
            with open(full, "wb") as out:
                out.write(head)
                while chunk := await upload.read(_CHUNK):
                    size += len(chunk)
                    if size > limit:
                        raise MediaRejected(
                            f"{'Photo' if kind == 'photo' else 'Video'} is larger than {limit // (1024 * 1024)} MB."
                        )
                    out.write(chunk)
        except BaseException:
            if os.path.exists(full):
                os.remove(full)
            raise
        return StoredMedia(kind=kind, path=rel, content_type=content_type, size=size)

    def delete(self, path: str) -> None:
        full = os.path.join(self.root, *path.split("/"))
        if os.path.isfile(full):
            os.remove(full)

    def url(self, path: str) -> str:
        return f"{settings.MEDIA_URL_PREFIX}/{path}"


async def _read_checked(upload: UploadFile, allow_video: bool) -> tuple[bytes, str, str, str]:
    """Whole file in memory after the same type/size checks as local storage."""
    head = await upload.read(16)
    detected = _sniff(head)
    if not detected or (detected[0] == "video" and not allow_video):
        raise MediaRejected("Only JPG, PNG or WEBP photos and MP4, MOV or WEBM videos are allowed."
                            if allow_video else "Upload a JPG, PNG or WEBP photo.")
    kind, ext, content_type = detected
    limit = MAX_PHOTO_BYTES if kind == "photo" else MAX_VIDEO_BYTES
    data = bytearray(head)
    while chunk := await upload.read(_CHUNK):
        data += chunk
        if len(data) > limit:
            raise MediaRejected(f"{'Photo' if kind == 'photo' else 'Video'} is larger than {limit // (1024 * 1024)} MB.")
    return bytes(data), kind, ext, content_type


# Delivery transformations: smaller files for phones, no visible quality loss
_DELIVERY = {"image": "f_auto,q_auto,c_limit,w_1600", "video": "q_auto,vc_auto"}
_CLD_HOST = "res.cloudinary.com"


class CloudinaryStorage:
    def __init__(self, cloudinary_url: str, local: LocalStorage):
        import cloudinary
        cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
        self.local = local

    async def save(self, upload: UploadFile, folder: str, allow_video: bool = True) -> StoredMedia:
        from fastapi.concurrency import run_in_threadpool
        import cloudinary.uploader
        data, kind, _ext, content_type = await _read_checked(upload, allow_video)
        resource_type = "image" if kind == "photo" else "video"
        try:
            result = await run_in_threadpool(
                cloudinary.uploader.upload, data,
                resource_type=resource_type, folder=f"comis/{folder}", public_id=uuid.uuid4().hex,
                overwrite=False,
            )
        except Exception as e:
            raise MediaRejected(f"Upload to media storage failed, please try again. ({type(e).__name__})")
        return StoredMedia(kind=kind, path=result["secure_url"], content_type=content_type, size=len(data))

    def delete(self, path: str) -> None:
        if not path:
            return
        if not path.startswith("http"):
            self.local.delete(path)
            return
        parsed = _parse_cloudinary_url(path)
        if not parsed:
            return
        import cloudinary.uploader
        resource_type, public_id = parsed
        try:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
        except Exception:
            pass   # a leftover file is harmless; never fail the user's delete because of it

    def url(self, path: str) -> str:
        if not path.startswith("http"):
            return self.local.url(path)
        return _with_delivery(path)


def _parse_cloudinary_url(url: str) -> tuple[str, str] | None:
    """https://res.cloudinary.com/<cloud>/<image|video>/upload/[v123/]<public_id>.<ext> -> (type, public_id)"""
    if _CLD_HOST not in url or "/upload/" not in url:
        return None
    resource_type = "video" if "/video/upload/" in url else "image"
    rest = url.split("/upload/", 1)[1].split("?")[0]
    parts = rest.split("/")
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    public_id = "/".join(parts).rsplit(".", 1)[0]
    return resource_type, public_id


def _with_delivery(url: str) -> str:
    if _CLD_HOST not in url or "/upload/" not in url:
        return url
    resource_type = "video" if "/video/upload/" in url else "image"
    head, tail = url.split("/upload/", 1)
    return f"{head}/upload/{_DELIVERY[resource_type]}/{tail}"


class _HybridUrls:
    """Read side for local-only mode: still understands Cloudinary URLs already in the database."""
    def __init__(self, local: LocalStorage):
        self.local = local

    async def save(self, upload: UploadFile, folder: str, allow_video: bool = True) -> StoredMedia:
        return await self.local.save(upload, folder, allow_video)

    def delete(self, path: str) -> None:
        if path and not path.startswith("http"):
            self.local.delete(path)

    def url(self, path: str) -> str:
        return _with_delivery(path) if path.startswith("http") else self.local.url(path)


def _build_storage():
    local = LocalStorage(settings.MEDIA_ROOT)
    if settings.CLOUDINARY_URL:
        return CloudinaryStorage(settings.CLOUDINARY_URL, local)
    return _HybridUrls(local)


storage = _build_storage()
