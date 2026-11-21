# Dental chart 3D model — asset specification

The 3D dental chart renders either:

- **the bundled anatomical model** (default): `public/models/dentition-bp3d.glb`,
  built from BodyParts3D (CC BY-SA 2.1 JP) by `scripts/build-bodyparts3d-dentition.mts`.
  28 CT-derived permanent teeth split into crown/root, gingiva over the alveolar
  ridges, maxilla and mandible; third molars are schematic. ≈1 MB, ≈119k triangles.
  Licence and changes: `public/models/LICENSE-dentition.txt`.
- **the realistic mouth** ("Realistic mouth" in the viewer's model menu):
  `public/models/mouth-realistic.glb`, built from "Human teeth" by Alexander Antipov
  (CC BY 4.0) by `scripts/build-realistic-mouth.mts` (`pnpm model:build-mouth`, source
  in the git-ignored `assets-src/realistic-mouth/human_teeth.glb`). Textured crowns, gums
  and tongue for a lifelike look; crowns only (no roots, pulp or bone). ≈0.8 MB, ≈16k
  triangles. Licence and changes: `public/models/LICENSE-mouth-realistic.txt`. Override
  with `NEXT_PUBLIC_DENTAL_REALISTIC_MODEL_URL`.
- **another anatomical model**: a GLB set with `NEXT_PUBLIC_DENTAL_MODEL_URL` (any
  public URL, e.g. Cloudinary or an R2 public bucket, or a path under `/public`).
- **the built-in schematic model**: `NEXT_PUBLIC_DENTAL_MODEL_URL=schematic` —
  procedurally generated teeth with average proportions and schematic enamel, dentin
  and pulp layers, labelled "Schematic model" in the viewer.

The variable is read at build time: rebuild/redeploy after changing it.

If the supplied model fails to download or parse, the chart falls back to the
schematic model and says so. Missing teeth or layers are listed in a notice.

Clinical data never comes from the model: statuses, restorations, notes and
history always come from the patient record.

## Licensing — required before use

Only use a model you have the right to ship in a commercial web application:

- commissioned work with a written transfer/licence covering web distribution, or
- a purchased licence that explicitly allows **embedding in an application**
  (many marketplace "standard" licences forbid redistributing the file, and a GLB
  served to browsers *is* redistributed), or
- CC0 / CC-BY (with attribution shown in the app).

Do **not** download or extract models from online viewers (e.g. Sketchfab
"view-only" models), even if a browser tool can capture them.

## Rebuilding the bundled model

```bash
node scripts/fetch-bodyparts3d.mjs   # ≈5 MB into the git-ignored assets-src/bodyparts3d/
pnpm exec tsx scripts/build-bodyparts3d-dentition.mts
```

The script levels the occlusal plane, opens the jaw about the condyles, builds the
tooth frames, covers the alveolar ridges with gingiva, bakes vertex colours,
simplifies to the triangle budget and Meshopt-compresses the result.

## Devices without usable 3D

On load the chart checks what 3D the browser can do:

- **GPU WebGL** → the interactive model.
- **Software-only WebGL** (blocklisted driver, hardware acceleration off) → the
  image view by default, with "Try the interactive 3D view anyway".
- **No WebGL** (blocked or unsupported) → the image view, with advice to turn on
  hardware acceleration.

If the interactive view crashes or the browser drops its WebGL context (GPU reset),
it switches to the image view and offers to restore the 3D view.

The image view uses `public/models/fallback/` — 11 pre-rendered WebP stills (front
turntable ±60°, upper and lower occlusal, ≈240 KB total) plus `views.json` with each
tooth's label position, so labels show the patient's recorded statuses and select
teeth like the 3D view. Re-render after rebuilding the model:

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright pnpm model:render-fallback
```

`?graphics=none` or `?graphics=software` on the dental chart URL forces those modes
for testing and support.

## File format and budgets

| Item | Requirement |
|---|---|
| Format | glTF 2.0 binary (`.glb`) |
| Units | millimetres (a model in metres is detected and scaled, with a warning) |
| Compression | `EXT_meshopt_compression` (decoded locally). Draco and KTX2 are **not** enabled (they would need CDN decoders) |
| Textures | WebP or JPEG, ≤ 2048², shared atlases preferred |
| Size | ≤ 8 MB compressed for the whole dentition; ≤ 15 MB hard limit |
| Triangles | ≈ 300k total (≈ 6–8k per tooth across all layers, gums ≤ 40k each, bone ≤ 60k each) |
| Materials | PBR metallic-roughness; enamel may use `KHR_materials_transmission`/`volume` sparingly |

## Scene structure (names are case-sensitive)

```
<root>
├─ tooth_11                      empty / group — the tooth frame (see below)
│  ├─ tooth_11_enamel            REQUIRED — crown enamel, closed mesh
│  ├─ tooth_11_dentin            root + coronal dentin (cementum may be included), closed
│  ├─ tooth_11_pulp              pulp chamber + canals, closed
│  └─ tooth_11_nerve             optional — neurovascular bundle
├─ tooth_12 … tooth_48           all 32 permanent FDI positions (missing ones are reported)
├─ gingiva_upper, gingiva_lower  optional
└─ maxilla, mandible             optional — enables the "Jaw bone" layer
```

Each layer should be a single mesh (the first mesh found under the name is used).

A model without a `_dentin` layer (crowns only) can put `{ "rootLength": <mm> }` in a
tooth node's `extras`: how deep its gum reaches below that crown's CEJ. The viewer sizes
what it draws there (an implant fixture) to fit, instead of using an average root.

Optional metadata in the root scene's `extras` (glTF) / `userData` (three.js):

```json
{ "dentalhub": { "description": "…shown in the layer menu…",
                 "credit": "…attribution the licence requires…",
                 "creditUrl": "https://…" } }
```

`credit` is shown permanently in the viewer — use it for CC BY / BY-SA models.
Layers must be **closed and nested** (pulp inside dentin, dentin inside enamel and
root): the cross-section view caps cut surfaces by drawing back faces, which only
works for watertight, correctly-wound meshes.

## Coordinate frames

**Tooth frame** (`tooth_<FDI>` node): origin at the centre of the
cemento-enamel junction; **+Y** towards the occlusal/incisal edge; **+Z** buccal/labial;
**+X** along the arch towards the patient's left. Restoration patches, labels,
focus and cross-sections are computed in this frame.

**Arch placement** (node world transforms): same layout as the schematic model —
patient's left on **+X**, front teeth near **z = 0** with the arch running back
(−Z), occlusal mid-plane at **y ≈ 0**, upper crowns pointing down and lower crowns
pointing up, with the mouth open (≈12–20mm between incisal edges) for inspection.
Camera presets frame the model's own crowns and gums, so exact arch size doesn't matter.

The easiest way to get every name, frame and position right is to start from the
reference skeleton:

```bash
pnpm exec tsx scripts/export-reference-dentition.mts reference.glb
```

It exports the schematic model with the exact structure above. Replace each mesh
in place (keeping the `tooth_<FDI>` nodes) and export as GLB.

## Layers in the viewer

| Layer | Source | Notes |
|---|---|---|
| Enamel | `_enamel` | Recorded restorations/lesions are drawn on it |
| Dentin & roots | `_dentin` | Root-canal-treated teeth show it see-through |
| Pulp | `_pulp` | Visible in cross-section or with dentin hidden; drawn as obturated canals for root-canal-treated teeth |
| Nerves & vessels | `_nerve` | Only when supplied — never synthesised |
| Jaw bone | `maxilla` / `mandible` | Only when supplied — never synthesised |

## Optimising an exported model

```bash
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 2048
```

Check the result loads with no notice in the 3D chart, then upload it and set
`NEXT_PUBLIC_DENTAL_MODEL_URL`.
