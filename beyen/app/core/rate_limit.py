"""
Sliding-window rate limiter for logins, password resets, posting, etc.

With REDIS_URL set, counters live in Redis: shared by every backend worker and
surviving restarts. Without it (or if Redis is unreachable) they fall back to
this process's memory, so a Redis outage never blocks logins.
"""
import time
import threading
import uuid
from collections import defaultdict, deque
from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, window: float, now: float) -> deque:
        hits = self._hits[key]
        while hits and hits[0] <= now - window:
            hits.popleft()
        return hits

    def is_limited(self, key: str, limit: int, window: float) -> bool:
        """True if `key` already has `limit` hits inside the last `window` seconds."""
        with self._lock:
            return len(self._prune(key, window, time.monotonic())) >= limit

    def hit(self, key: str) -> None:
        with self._lock:
            self._hits[key].append(time.monotonic())

    def check_and_hit(self, key: str, limit: int, window: float) -> bool:
        """Record a hit unless the key is already limited. Returns True if limited."""
        with self._lock:
            now = time.monotonic()
            hits = self._prune(key, window, now)
            if len(hits) >= limit:
                return True
            hits.append(now)
            return False

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


# Longest window any caller uses; keys expire after this so Redis never fills up
MAX_WINDOW_SECONDS = 60 * 60


class RedisRateLimiter:
    """Same interface as RateLimiter, backed by one sorted set per key (score = timestamp)."""
    PREFIX = "comis:rl:"

    def __init__(self, url: str):
        import redis
        self._r = redis.Redis.from_url(url, socket_timeout=3, socket_connect_timeout=3)
        self._fallback = RateLimiter()

    def _count(self, key: str, window: float, now: float) -> int:
        k = self.PREFIX + key
        pipe = self._r.pipeline()
        pipe.zremrangebyscore(k, 0, now - window)
        pipe.zcard(k)
        return pipe.execute()[1]

    def _add(self, key: str, now: float) -> None:
        k = self.PREFIX + key
        pipe = self._r.pipeline()
        pipe.zadd(k, {f"{now}:{uuid.uuid4().hex[:8]}": now})
        pipe.expire(k, MAX_WINDOW_SECONDS)
        pipe.execute()

    def is_limited(self, key: str, limit: int, window: float) -> bool:
        try:
            return self._count(key, window, time.time()) >= limit
        except Exception:
            return self._fallback.is_limited(key, limit, window)

    def hit(self, key: str) -> None:
        try:
            self._add(key, time.time())
        except Exception:
            self._fallback.hit(key)

    def check_and_hit(self, key: str, limit: int, window: float) -> bool:
        try:
            now = time.time()
            if self._count(key, window, now) >= limit:
                return True
            self._add(key, now)
            return False
        except Exception:
            return self._fallback.check_and_hit(key, limit, window)

    def reset(self, key: str | None = None) -> None:
        self._fallback.reset(key)
        try:
            if key is None:
                for k in self._r.scan_iter(self.PREFIX + "*"):
                    self._r.delete(k)
            else:
                self._r.delete(self.PREFIX + key)
        except Exception:
            pass


def _build_limiter():
    from app.core.config import settings
    if settings.REDIS_URL:
        return RedisRateLimiter(settings.REDIS_URL)
    return RateLimiter()


limiter = _build_limiter()


def client_ip(request: Request) -> str:
    # uvicorn runs with --proxy-headers behind nginx, so request.client is the real client
    return request.client.host if request.client else "unknown"


def too_many_requests(retry_after_seconds: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Too many attempts. Please wait a few minutes and try again.",
        headers={"Retry-After": str(retry_after_seconds)},
    )
