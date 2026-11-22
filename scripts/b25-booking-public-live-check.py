#!/usr/bin/env python3
"""Read-only check that a PUBLIC published Lovable app serves the Booking #104 bundle.

No credentials, no user data, no writes to Lovable, no browser login.
Exit nonzero if site missing, JS missing, or the three Owner Booking strings absent.
"""
import html.parser
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import deque

HOST = "pixel-perfect-homestay-hub.lovable.app"
BASE = "https://" + HOST + "/"
MAX_FILES = 150
MAX_BYTES = 36_000_000
MARKERS = ("cancel_booking_owner", "reschedule_booking_owner", "Kelola Booking")
AGENT = "Baturaden25-public-release-readonly-probe/1.0"

class Tags(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "script" and d.get("src"):
            self.scripts.append(d["src"])
        if tag == "link" and d.get("rel") == "modulepreload" and d.get("href"):
            self.scripts.append(d["href"])

def request(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=25) as response:
        result_url = response.geturl()
        parsed = urllib.parse.urlsplit(result_url)
        if parsed.scheme != "https" or parsed.hostname != HOST:
            raise RuntimeError("STOP: public page unexpectedly redirects to another host")
        status = response.status
        kind = response.headers.get("content-type", "")
        body = response.read(8_000_000 + 1)
        if len(body) > 8_000_000:
            raise RuntimeError("STOP: unexpected oversized public asset")
        return status, kind, body

def normalize(parent, candidate):
    if not candidate or candidate.startswith(("data:", "blob:", "javascript:", "//")):
        return None
    dest = urllib.parse.urljoin(parent, candidate)
    url = urllib.parse.urlsplit(dest)
    if url.hostname != HOST or url.scheme != "https":
        return None
    if not url.path.endswith(".js"):
        return None
    return dest.split("?", 1)[0]

def main():
    status, kind, data = request(BASE)
    if status != 200 or b"<html" not in data.lower():
        raise RuntimeError("STOP: published site did not serve an HTML application page")
    page = data.decode("utf-8", "replace")
    tags = Tags()
    tags.feed(page)
    queue = deque()
    for src in tags.scripts:
        target = normalize(BASE, src)
        if target:
            queue.append(target)
    if not queue:
        raise RuntimeError("STOP: published HTML has no executable JavaScript entry")
    found = {marker: False for marker in MARKERS}
    seen = set()
    bytes_seen = 0
    while queue and len(seen) < MAX_FILES and bytes_seen < MAX_BYTES:
        url = queue.popleft()
        if url in seen:
            continue
        seen.add(url)
        status, kind, asset = request(url)
        if status != 200:
            raise RuntimeError("STOP: missing JavaScript dependency on published domain")
        bytes_seen += len(asset)
        text = asset.decode("utf-8", "replace")
        for marker in MARKERS:
            if marker in text:
                found[marker] = True
        # Vite bundles reference lazy chunks as "./booking-abc.js" (plus assets).
        candidates = re.findall(
            r"""["']((?:\./|\.\./|/assets/)[^"'<> ]+?\.js)["']""", text
        )
        for ref in candidates:
            target = normalize(url, ref)
            if target and target not in seen:
                queue.append(target)
        if all(found.values()):
            break
    print(f"PUBLIC_URL={BASE}")
    print(f"HTTP_HTML_OK=YES")
    print(f"PUBLIC_JS_ASSETS_CHECKED={len(seen)}")
    print(f"PUBLIC_JS_BYTES_CHECKED={bytes_seen}")
    for key, value in found.items():
        print(f"PUBLIC_MARKER_{key}={'PASS' if value else 'NOT_FOUND'}")
    if not all(found.values()):
        raise RuntimeError("STOP: Published JS has not proven PR #104 Booking code is live")
    print("B25_BOOKING_PR104_PUBLIC_CLIENT_BUNDLE=PASS")
    print("SCOPE=public bundle only; not an authenticated browser click")

if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.URLError, TimeoutError) as e:
        print(f"PUBLICATION_CHECK_NOT_PROVEN: {e}", file=sys.stderr)
        sys.exit(1)
