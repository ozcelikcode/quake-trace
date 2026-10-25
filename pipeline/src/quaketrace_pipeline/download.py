"""Cached downloads into pipeline/.cache (ignored by Git)."""

import time
from collections.abc import Mapping
from pathlib import Path

import httpx

from .config import CACHE_DIR, USER_AGENT

TIMEOUT = httpx.Timeout(60.0, read=300.0)
ATTEMPTS = 4
BACKOFF_SECONDS = 2.0

# Upstream servers (notably the KOERI and EMODnet services) occasionally drop connections.
RETRYABLE = (httpx.TransportError, httpx.RemoteProtocolError)


def _download(
    url: str, target: Path, params: Mapping[str, str] | None, headers: dict[str, str]
) -> None:
    partial = target.with_suffix(target.suffix + ".part")
    with httpx.stream(
        "GET", url, params=params, headers=headers, timeout=TIMEOUT, follow_redirects=True
    ) as response:
        response.raise_for_status()
        with partial.open("wb") as file:
            for chunk in response.iter_bytes(chunk_size=1 << 20):
                file.write(chunk)
    partial.replace(target)


def fetch(
    url: str,
    file_name: str,
    *,
    params: Mapping[str, str] | None = None,
    headers: Mapping[str, str] | None = None,
    refresh: bool = False,
) -> Path:
    """Downloads `url` once; later calls return the cached file unless `refresh` is set."""
    target = CACHE_DIR / file_name
    if target.exists() and not refresh:
        return target

    target.parent.mkdir(parents=True, exist_ok=True)
    request_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    for attempt in range(1, ATTEMPTS + 1):
        print(f"  downloading {url} (attempt {attempt}/{ATTEMPTS})")
        try:
            _download(url, target, params, request_headers)
            return target
        except RETRYABLE:
            if attempt == ATTEMPTS:
                raise
            time.sleep(BACKOFF_SECONDS * attempt)
    raise AssertionError("unreachable")
