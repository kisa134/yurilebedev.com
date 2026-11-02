#!/usr/bin/env python3
"""Stamp cache-busting versions on os/ assets in every HTML page. Run before each commit: python3 tools/release.py"""
import hashlib, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
pages = [root / 'index.html']
changed = False
for page in pages:
    html = page.read_text()
    def stamp(m):
        f = root / m.group(1)
        v = hashlib.md5(f.read_bytes()).hexdigest()[:8]
        return f'{m.group(1)}?v={v}'
    new = re.sub(r'(os/[a-z0-9_.-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?', stamp, html)
    if new != html:
        page.write_text(new); changed = True
print('stamped' if changed else 'up to date')
