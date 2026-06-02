"""Lightweight World Cup / football news via RSS feeds, cached in Redis."""

import asyncio
import json as _json
import logging
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter
from redis import Redis

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/news", tags=["news"])

CACHE_KEY = "news:headlines"
# Cache lives until the next scheduled refresh (12h max, but refresh job overwrites it)
CACHE_TTL = 43200  # 12 hours

RSS_FEEDS = [
    # Español
    ("Marca", "https://e00-marca.uecdn.es/rss/futbol.xml"),
    ("Mundo Deportivo", "https://www.mundodeportivo.com/feed/rss/futbol"),
    ("Sport", "https://www.sport.es/es/rss/futbol/rss.xml"),
    ("AS", "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/"),
    # Português
    ("ESPN Brasil", "https://www.espn.com.br/rss/futebol"),
    ("Record", "https://www.record.pt/rss"),
    ("zerozero", "https://www.zerozero.pt/rss/noticias.php"),
]

MAX_ITEMS = 20
# Cap per source to ensure diversity across feeds
MAX_PER_SOURCE = 3

FALLBACK_IMAGE = "https://us-mia-1.linodeobjects.com/qrengagement/assets/fifa_wc2026_poster.jpg"


def _get_redis() -> Redis:
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


def _parse_rss(xml_data: bytes, source: str) -> list[dict]:
    """Parse RSS XML into headline dicts, extracting images when available."""
    items: list[dict] = []
    NS_MEDIA = "{http://search.yahoo.com/mrss/}"
    try:
        root = ElementTree.fromstring(xml_data)
        for item in root.iter("item"):
            title_el = item.find("title")
            link_el = item.find("link")
            pub_el = item.find("pubDate")
            desc_el = item.find("description")
            if title_el is None or title_el.text is None:
                continue

            # Extract image from media:content, media:thumbnail, or enclosure
            image_url: str | None = None
            media_content = item.find(f"{NS_MEDIA}content")
            media_thumb = item.find(f"{NS_MEDIA}thumbnail")
            enclosure = item.find("enclosure")

            if media_thumb is not None:
                image_url = media_thumb.get("url")
            elif media_content is not None and "image" in (media_content.get("type", "") or media_content.get("medium", "") or "image"):
                image_url = media_content.get("url")
            elif enclosure is not None and "image" in (enclosure.get("type", "") or ""):
                image_url = enclosure.get("url")

            title = title_el.text.strip()
            # Strip leaked CDATA wrappers some feeds emit
            if title.startswith("<![CDATA["):
                title = title.removeprefix("<![CDATA[").removesuffix("]]>").strip()

            items.append(
                {
                    "title": title,
                    "url": link_el.text.strip() if link_el is not None and link_el.text else "",
                    "published": pub_el.text.strip() if pub_el is not None and pub_el.text else "",
                    "summary": (desc_el.text.strip()[:200] if desc_el is not None and desc_el.text else ""),
                    "source": source,
                    "image_url": image_url,
                }
            )
    except Exception as exc:
        logger.warning("RSS parse error for %s: %s", source, exc)
    return items


async def _fetch_headlines() -> list[dict]:
    """Fetch from all RSS feeds, merge, dedupe, round-robin mix sources, limit."""
    all_items: list[dict] = []

    async def _fetch_one(client: httpx.AsyncClient, source: str, url: str) -> list[dict]:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                return _parse_rss(resp.content, source)
        except Exception as exc:
            logger.warning("RSS fetch error for %s: %s", source, exc)
        return []

    async with httpx.AsyncClient(
        timeout=8,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (compatible; RedzoneBot/1.0)"},
    ) as client:
        results = await asyncio.gather(
            *[_fetch_one(client, source, url) for source, url in RSS_FEEDS]
        )
        for items in results:
            all_items.extend(items)

    # Deduplicate by normalised title
    seen: set[str] = set()
    unique: list[dict] = []
    for item in all_items:
        key = item["title"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(item)

    # Sort newest first (best-effort date parsing)
    unique.sort(key=lambda i: i.get("published", ""), reverse=True)

    # Round-robin mix: take up to MAX_PER_SOURCE from each source, interleaved
    # Within each source, prefer items that already have an image
    by_source: dict[str, list[dict]] = {}
    for item in unique:
        src = item["source"]
        by_source.setdefault(src, [])
        if len(by_source[src]) < MAX_PER_SOURCE:
            by_source[src].append(item)

    # Sort each source list: items with images first
    for src in by_source:
        by_source[src].sort(key=lambda i: (0 if i.get("image_url") else 1))

    # Interleave: pick one from each source in order, repeat
    mixed: list[dict] = []
    source_lists = list(by_source.values())
    idx = 0
    while len(mixed) < MAX_ITEMS and source_lists:
        source_lists = [sl for sl in source_lists if idx < len(sl)]
        for sl in source_lists:
            if idx < len(sl) and len(mixed) < MAX_ITEMS:
                mixed.append(sl[idx])
        idx += 1

    # Ensure every item has an image; use fallback if missing
    for item in mixed:
        if not item.get("image_url"):
            item["image_url"] = FALLBACK_IMAGE

    return mixed


async def refresh_news_cache() -> int:
    """Re-fetch headlines and write to Redis. Returns item count. Used by scheduled job."""
    headlines = await _fetch_headlines()
    if headlines:
        r = _get_redis()
        r.setex(CACHE_KEY, CACHE_TTL, _json.dumps(headlines))
    return len(headlines)


@router.get("")
async def get_news():
    """Return cached football headlines."""
    r = _get_redis()
    cached = r.get(CACHE_KEY)
    if cached:
        return {"data": _json.loads(cached)}

    headlines = await _fetch_headlines()
    if headlines:
        r.setex(CACHE_KEY, CACHE_TTL, _json.dumps(headlines))
    return {"data": headlines}
