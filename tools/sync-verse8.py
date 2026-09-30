"""Copy this static site into a Verse8 (Vite) project.

    python tools/sync-verse8.py <path-to-verse8-repo>

Verse8 builds with `vite build` and deploys `dist/`. Vite copies `public/` as-is,
so every static file goes there, and the landing page becomes the Vite entry
`index.html` with root-absolute URLs ("/shared/...") that Vite resolves to
`public/` and rewrites for `base: "./"`.

Replaced on every run: <verse8>/index.html and <verse8>/public/{shared,landing,games,assets}.
Nothing else in the Verse8 repo (.agent8.lock, .env, src/, package.json ...) is touched.
"""
import hashlib
import os
import re
import shutil
import sys
import time
from pathlib import Path


def long_path(p):
    """Windows: opt into >260-char paths (deep game folders in long workspace paths)."""
    p = os.path.abspath(p)
    prefix = "\\\\?\\"   # \\?\
    if os.name == "nt" and not p.startswith(prefix):
        p = prefix + p
    return Path(p)


ROOT = long_path(Path(__file__).parent.parent)
COPY_DIRS = ["shared", "landing", "games", "pages"]
# Runtime assets only (no assets/source). Every folder under assets/ except source/ — a new art
# folder is picked up without editing this list.
ASSET_DIRS = sorted("assets/" + p.name for p in (Path(__file__).resolve().parent.parent / "assets").iterdir()
                    if p.is_dir() and p.name != "source")


# A quoted or url() path into assets/ ending in a media extension, without a query yet.
asset_ref = re.compile(r"""(["'(])((?:\.\./|\./|/)*)(assets/[^"'()?*\s]+\.(?:webp|png|jpe?g|gif|svg|mp3|ogg|m4a|wav|woff2?))(?=["')])""")
_hashes = {}


def hash_ref(m):
    rel = m.group(3)
    if rel not in _hashes:
        f = ROOT / rel
        _hashes[rel] = hashlib.md5(f.read_bytes()).hexdigest()[:8] if f.is_file() else None
    h = _hashes[rel]
    return m.group(0) if h is None else m.group(1) + m.group(2) + rel + "?v=" + h


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    target = long_path(sys.argv[1])
    if not (target / "vite.config.ts").exists():
        sys.exit(f"{target} does not look like the Verse8 project (no vite.config.ts)")

    public = target / "public"
    for name in COPY_DIRS + ["assets"]:
        shutil.rmtree(public / name, ignore_errors=True)
    for name in COPY_DIRS + ASSET_DIRS:
        shutil.copytree(ROOT / name, public / name)

    # Cache-busting: every local script/stylesheet gets ?v=<build>, so a CDN or browser
    # never pairs a fresh page with a stale members.js / config that points at files
    # which no longer exist.
    version = time.strftime("%Y%m%d%H%M%S")
    local_ref = re.compile(r'((?:src|href)=")(?!https?:|//|#|data:)([^"?]+\.(?:js|css))(")')

    def bust(text):
        return local_ref.sub(lambda m: m.group(1) + m.group(2) + "?v=" + version + m.group(3), text)

    # Verse8-only files: server.js (leaderboard), the server bridge and the Vite config
    # that emits it as shared/cv-server.js.
    for rel in ["server.js", "vite.config.ts", "src/cv-server.ts"]:
        (target / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / "verse8" / rel, target / rel)

    # First admins (Verse8 account ids) live in verse8/admins.local.json, which is not in the
    # public repo: written into the Verse8 copy of server.js only.
    admins_file = ROOT / "verse8" / "admins.local.json"
    if admins_file.exists():
        import json
        ids = [str(a) for a in json.loads(admins_file.read_text(encoding="utf-8")) if str(a).strip()]
        srv = target / "server.js"
        text = srv.read_text(encoding="utf-8")
        text = text.replace("[/*ADMINS*/]", json.dumps(ids))
        srv.write_text(text, encoding="utf-8", newline="\n")
        print(f"admins: {len(ids)} from verse8/admins.local.json")

    # Static hub pages (games, content pages) load the built bridge as a module, from the
    # same folder as their cv-storage.js. Pages without it (the integration sample game,
    # which only talks postMessage) get no bridge.
    storage_src = re.compile(r'src="([./]*)shared/cv-storage\.js')
    for page in list((public / "games").rglob("index.html")) + list((public / "pages").rglob("index.html")):
        text = bust(page.read_text(encoding="utf-8"))
        m = storage_src.search(text)
        if m:
            bridge = '  <script type="module" src="' + m.group(1) + 'shared/cv-server.js?v=' + version + '"></script>\n'
            text = text.replace("</body>", bridge + "</body>", 1)
        page.write_text(text, encoding="utf-8", newline="\n")

    # Landing page -> Vite entry. Local href/src become root-absolute public URLs;
    # the bridge is bundled straight from its source.
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'(href|src)="(?!https?:|/|#|data:)([^"]+)"', r'\1="/\2"', html)
    html = bust(html).replace("</body>", '  <script type="module" src="/src/cv-server.ts"></script>\n</body>', 1)
    (target / "index.html").write_text(html, encoding="utf-8", newline="\n")

    # Art and sound keep their file names when they are redrawn, so every reference to a
    # file under assets/ gets ?v=<content hash>: a changed file gets a new URL and no phone
    # mixes a cached old picture with new ones; unchanged files keep theirs (cache stays warm).
    texts = [p for ext in ("*.js", "*.css", "*.html") for p in public.rglob(ext)] + [target / "index.html"]
    for f in texts:
        text = f.read_text(encoding="utf-8")
        new = asset_ref.sub(hash_ref, text)
        if new != text:
            f.write_text(new, encoding="utf-8", newline="\n")

    count = sum(1 for _ in public.rglob("*") if _.is_file())
    print(f"synced -> {target} ({count} files in public/)")


if __name__ == "__main__":
    main()
