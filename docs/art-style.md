# Art style — one look for every picture

All raster art (landing, bingo, games, content pages) is drawn in **one** style. When a picture is
added or replaced, it follows this page; when in doubt, put it next to the member chibis and the
shark — it has to look like it came from the same game.

## References (always attach both when generating)

- `assets/chibi/*.webp` — the member chibis: the anchor of the style.
- `assets/escape/shark.webp` (raw: `assets/source/gen/shark.png`) — the first object drawn in it.

## Rules

| | |
|---|---|
| Look | cute chibi mobile-game illustration, not photography, not 3D render |
| Line | clean dark-navy outline (#1f2a3a-ish), even weight, slightly thicker on the silhouette |
| Shading | soft cel shading: one shadow tone + one glossy highlight, a tiny sparkle on shiny things |
| Shapes | rounded, chubby, friendly; simplified detail |
| Palette | ivory #f6efe0, cream, gold #c9ae78 → #e2cc98, onyx #0b0a08, espresso; caviar colours: almas ivory-white, imperial olive-green, classic black with blue sheen, platinum amber-gold, white pearl pearly white |
| Background | objects: fully transparent. Scenes (table, basket): simple flat illustrated background in the same palette |
| Text | none inside pictures, except the "CAVIAR MENU" cover on the table scene. Names and labels are page text (translated) |
| Faces | only the members and the shark. No faces on food, tins or caviar (caviar = the members' symbol: never burst or crush it) |
| Views | follow the existing composition of the picture being replaced (top-down for plate items, 3/4 for tins and drinks) |

## Generating

- Through Codex with the ChatGPT plan (no API key): `codex exec -i <style refs> -i <old picture> -- "<prompt>"`,
  or `python tools/gen-art.py` with `OPENAI_API_KEY`. Prompts use the `CUTE` style string there.
- Raw PNGs are kept in `assets/source/gen/`; the game uses trimmed WebPs.
- Scenes, layers and effect sheets (Caviar Escape, 2026-10-02): `codex exec -s workspace-write -i <refs> - < prompt.txt`
  with "use your image generation tool … save to assets/source/gen/…". Ask for a **transparent background** for
  sprite sheets (it works); several items go on one sheet in a fixed grid, then a script cuts them
  (`tools/make-escape-art.py`: drops faint alpha specks, trims, resizes, writes WebP).
- Nothing in play may look like a pickup: a background must not contain pearls, coins or anything round and
  ivory. Backgrounds keep the middle plain and dark so sharks, pearls and members read on top.
- **Never draw pictures in code** (no canvas shapes, no CSS colour boxes for panels or buttons). Code only moves
  generated art. Show candidates (an HTML page) before committing new art; commit only the chosen ones.
- Check every image: transparent edges without halos, no stray text, no second object.
