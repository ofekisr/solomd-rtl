#!/usr/bin/env bash
# Copy the installed SoloMD's state into the dev app (`pnpm --dir app tauri:dev`).
#   1. ~/Library/Application Support/app.solomd → app.solomd.dev (themes, index, completions)
#   2. installed app's localStorage → app/dev-seed/localstorage.json, which the
#      dev app imports on its next launch (settings, tabs, Theme Studio themes)
# Paths under app.solomd/ are rewritten to app.solomd.dev/ so the dev app uses its copies.
# Re-run any time to re-sync; the dev app applies each new seed once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROD_DATA="$HOME/Library/Application Support/app.solomd"
DEV_DATA="$HOME/Library/Application Support/app.solomd.dev"
PROD_WEBKIT="$HOME/Library/WebKit/app.solomd"
SEED_DIR="$ROOT/app/dev-seed"

mkdir -p "$DEV_DATA" "$SEED_DIR"
rsync -a --exclude 'dev-bridge.*' "$PROD_DATA/" "$DEV_DATA/"
echo "copied app data → $DEV_DATA"

PROD_WEBKIT="$PROD_WEBKIT" OUT="$SEED_DIR/localstorage.json" python3 -I - <<'PY'
import glob, json, os, sqlite3, time

SETTINGS_KEY = 'solomd.settings.v1'
PROD_DIR, DEV_DIR = '/app.solomd/', '/app.solomd.dev/'

def read_items(path):
    conn = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    rows = conn.execute('SELECT key, value FROM ItemTable').fetchall()
    conn.close()
    return {k: v.decode('utf-16-le') if isinstance(v, bytes) else str(v) for k, v in rows}

stores = glob.glob(os.path.join(os.environ['PROD_WEBKIT'], 'WebsiteData/Default/*/*/LocalStorage/localstorage.sqlite3'))
candidates = [(os.path.getmtime(p), p) for p in stores if SETTINGS_KEY in read_items(p)]
if not candidates:
    raise SystemExit('no installed-app localStorage with SoloMD settings found')
_, newest = max(candidates)
items = {k: v.replace(PROD_DIR, DEV_DIR) for k, v in read_items(newest).items()}
seed = {'seedId': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'items': items}
with open(os.environ['OUT'], 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False)
print(f"wrote {len(items)} localStorage keys → {os.environ['OUT']}")
PY
