# YAJA 2600 Animator v1.0.0

YAJA 2600 Animator is a browser and desktop creative tool for authoring Atari 2600 player-sprite animations and exporting round-trip batari Basic data or compilable demos.

## v1.0.0 stable notes

- Establishes standard semantic versioning for Animator releases.
- Adds Painter-style theme-aware dividers between Nudge, Scale, Rotation, and Flip in the Edit panel.
- Preserves the Composer-style Loop control and all v0.075 animation, export, and editing behavior.

## v0.075 working notes

- Replaces the timeline Loop checkbox and text with YAJA Composer's compact 36px loop-icon toggle.
- Uses the active theme color for the pressed state while retaining Composer's subdued inactive, hover, focus, and glow behavior.
- Preserves the existing loop project setting, playback behavior, accessibility state, and desktop menu command.

## v0.074 working notes

- Preserves hollow-shape topology during quarter turns, then resamples the lossless matrix to Atari pixel-aspect-correct physical dimensions.
- Keeps a representable hollow center from collapsing when the aspect-corrected raster becomes narrow.
- Moves Rotation Step above the Rotate Left/Right controls to match the Scale control order.
- Makes Clear a full-row action matching the width of Flip Color.

## v0.073 working notes

- Makes 90°, 180°, and 270° rotation lossless pixel-matrix operations so hollow outlines, gaps, and disconnected details remain intact.
- Keeps Atari pixel-aspect correction and expanded destination bounds for non-quarter-turn angles such as 45°.
- Adds regression coverage for hollow rectangles and four consecutive 90° rotations returning the exact source.

## v0.072 working notes

- Raises the default Rotation Step from 15° to 45°.
- Gives rotated artwork an aspect-aware destination raster sized to the rotated shape instead of forcing it back into its original bounding box.
- Keeps the expanded result centered on the original pivot and clips only when it reaches the actual Atari frame boundary.
- Preserves cumulative, trail-free rotation by resampling every step from the transform session's original pixels.

## v0.071 working notes

- Docks the themed frame-and-size readout to the bottom of the canvas workspace, directly above the Animation Timeline, without moving either sprite or its color column.
- Makes Nudge, Scale, Grow, Shrink, Flip, Rotation, Flip Color, and Clear selection-aware while preserving their whole-sprite behavior when no pixel selection exists.
- Tightens a drawn selection to its live pixels when an Edit operation or selection drag begins, then traces the exact transformed live-pixel mask after every subsequent edit.
- Renames `Clear Frame` to `Clear`; pixel selections clear pixels only, color-only selections are left unchanged, and no-selection Clear retains the existing full-sprite reset.

### Main canvas and Stamp Editor parity contract

Raster selection behavior shared with the Stamp Editor must remain mask-precise: selected live pixels define the manipulated payload, irregular masks keep their exposed-edge outline, pointer dragging and keyboard movement clip to the raster, and an empty selection exits without creating history. Any future raster-tool change should be tested against both surface adapters.

## v0.070 release notes

- Moves the canvas frame-and-size readout from the bottom edge to a stable position centered above the sprite composition.
- Themes the readout surface, border, shadow, divider, frame label, and size label through shared theme tokens.

## v0.069 release notes

- Keeps the Color Palette axis labels equally readable in Synthwave, Classic Light, and every other theme.
- Uses the active theme color for both selected-frame outlines instead of retaining a dark orange outer ring.
- Gives the Classic Light canvas readout a light panel surface with dark label text.

## v0.068 release notes

- Gives the Onion `Frames` control balanced spacing on both sides.
- Adds a native desktop shell with File, Edit, Animation, View, Window, and Help menus.
- Uses native desktop save/open dialogs while keeping the renderer identical to the web build.
- Bundles Orbitron, JetBrains Mono, and Press Start 2P locally for exact offline typography.
- Adds publish-ready web and desktop documentation, macOS unsigned-app guidance, and GitHub Actions packaging.
- Removes test and generated dependency content from distributable folders.

## Run the web version

Open `index.html` directly in Chrome, or run:

```powershell
npm ci
npm run dev
```

Then open `http://127.0.0.1:4222`.

## Build

```powershell
npm ci
npm run check
npm run build
```

The app uses one canonical `index.css` and one generated `app.bundle.js`. See [DOCUMENTATION.md](DOCUMENTATION.md) for the user guide and [PUBLISHING.md](PUBLISHING.md) for packaging notes.

## Release contents

- `index.html`, `index.css`, `app.bundle.js`: browser runtime
- `assets/fonts`: offline font assets shared by browser and desktop
- `src`: maintainable application modules
- `desktop`: Electron shell and native menu source
- `DOCUMENTATION.md`: user guide
- `HOW TO INSTALL ON MACOS.md`: Gatekeeper instructions

Earlier working-version folders are preserved unchanged.
