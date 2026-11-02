"""
In-memory sliding-window rate limiter for the auth endpoints.

State lives in the process, so limits are per worker. That is enough for a
single-instance deployment; move the counters to Redis before running several
backend replicas.
"""
import time
import threading
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


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # uvicorn runs with --proxy-headers behind nginx, so request.client is the real client
    return request.client.host if request.client else "unknown"


def too_many_requests(retry_after_seconds: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Too many attempts. Please wait a few minutes and try again.",
        headers={"Retry-After": str(retry_after_seconds)},
    )
