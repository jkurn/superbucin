# Superbucin — local asset inventory

This file is the **catalog of what exists on disk** in this repo for game art and 3D. Point agents here with `@ASSETS.md` instead of re-scanning the tree.

## Important: git and runtime

- All folders matching `kenney_*/` are **ignored by git** (see `.gitignore`) so clones do not include them. Keep packs on your machine or document how to re-download from [Kenney.nl](https://kenney.nl) (CC0).
- **Shipped client:** `client/src` currently has **no** imported `.png` / `.glb` / audio paths found; Pig vs Chick–style games use **procedural Three.js geometry** (e.g. `CubePetModels.js`). When you add real files for production, put them under `client/public/` or `client/src/assets/` and list them in the table below.

## Kenney packs (repo root)

Rough file counts are totals per folder (PNG + Vector + models + extras).

| Folder | ~Files | Kind | Notes |
|--------|--------:|------|--------|
| `kenney_animal-pack-remastered` | 284 | 2D | PNG variants (round/square, outline), spritesheets, vector |
| `kenney_boardgame-pack` | 583 | 2D | Dice, cards, chips, colored pieces; spritesheets |
| `kenney_cube-pets_1` | 129 | **3D** | `Models/GLB format`, OBJ, FBX, previews — **best match for cube pets** |
| `kenney_food-kit` | 1009 | **3D** | GLB/OBJ/FBX food props |
| `kenney_googly-eyes` | 12 | 2D | Small PNG layers |
| `kenney_jumper-pack` | 133 | 2D | Platformer tiles, players, enemies, HUD, backgrounds |
| `kenney_mini-characters` | 139 | **3D** | GLB/OBJ/FBX small characters |
| `kenney_physics-assets` | 369 | 2D | Destructible-style props, backgrounds, spritesheet |
| `kenney_pico-8-city` | 370 | 2D | PICO-8 style tiles / tilemaps |
| `kenney_pirate-pack` | 411 | 2D | Retina + default PNG, tilesheets |
| `kenney_robot-pack` | 63 | 2D | Side + top view robots |
| `kenney_shape-characters` | 219 | 2D | Shape people, default/double res |
| `kenney_shooting-gallery` | 124 | 2D | Gallery / carnival style |
| `kenney_space-shooter-remastered` | 314 | 2D | Ships, lasers, UI, meteors, backgrounds |
| `kenney_sports-pack` | 238 | 2D | Team colors, equipment, elements, tilesheet |
| `kenney_tanks` | 186 | 2D | Tanks, retina + default |
| `kenney_tappy-plane` | 89 | 2D | Planes, UI, letters/numbers |
| `kenney_toy-brick-pack` | 554 | 2D | LEGO-style bricks, vector + PNG |
| `kenney_ui-pack` | 1315 | 2D + audio + font | UI kits (multi-color), **Sounds**, **Font** |
| `kenney_ui-pack-rpg-expansion` | 94 | 2D | RPG UI add-on |

### Typical subfolders (Kenney convention)

- **2D:** `PNG/`, `Vector/`, `Spritesheet/`, sometimes `Tilesheet/`, `Tiled/`
- **3D:** `Models/GLB format/`, `OBJ format/`, `FBX format/` (+ `Textures/`)

## Optional folder layout (if you reorganize)

If the root feels crowded, move all packs under one parent and widen `.gitignore` once:

- `third_party/kenney/` or `assets/vendor/kenney/` — keeps `kenney_*` names or rename consistently.
- Update `.gitignore` to match (e.g. `third_party/kenney/` or `assets/vendor/**`).

No need to reorganize unless it bothers you; the inventory above stays valid if you only change the parent path.

## Maintenance

When you add a pack or copy files into `client/`, add one row or a short subsection here so the catalog stays true.
