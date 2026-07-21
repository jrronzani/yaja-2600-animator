# YAJA 2600 Animator v1.1.12

YAJA 2600 Animator is a browser and desktop creative tool for authoring Atari 2600 player-sprite animations and exporting round-trip batari Basic data or compilable demos.

## v1.1.12 working notes

- Prevents palette swatches from expanding into adjacent cells on hover; hover and active states now use stable inset outlines within fixed grid cells.

## v1.1.11 working notes

- Left-click Fill now fills contiguous empty canvas pixels without erasing existing art; right-click Fill erases a contiguous painted region.
- Left-click Fill in a scanline color column now fills the connected matching color run, instead of changing only one row.

## v1.1.10 working notes

- Stabilizes scanline-color painting while selecting a new palette color by reconciling only the live color-column row and completing its stroke before palette rerenders.

## v1.1.9 working notes

- Keeps the animation picker in the timeline-heading grid and gives it a dedicated responsive row before it can overlap timeline controls.

## v1.1.8 working notes

- Replaces the Chrome-clipped Project and Theme focus treatment with a complete inset theme ring.

## v1.1.7 working notes

- Raises Project and Theme controls above adjacent header layers and draws their complete border inset, preventing edge clipping.

## v1.1.6 working notes

- Restores complete, theme-aware borders around the Project and Theme header fields.

## v1.1.5 working notes

- Interpolates every raster cell crossed by rapid Pencil and Eraser strokes, preventing skipped pixels.
- Shares the same raster-line helper with the Stamp Editor, keeping its brush behavior in parity with the main canvas.

## v1.1.4 working notes

- Places focused brush dimension controls above adjacent controls so their theme focus rings never get clipped.
- Brings the animation-name field focus ring above the dropdown seam while preserving the arrow’s own active layering.

## v1.1.3 working notes

- Overrides the timeline heading’s inherited baseline and gap so all animation-library controls align as one compact row.

## v1.1.2 working notes

- Aligns the animation picker and library actions with the timeline title baseline.
- Matches picker entries to the animation-name field’s JetBrains Mono treatment.
- Enlarges the shared down-chevron and layers its highlighted border cleanly over the name field.

## v1.1.1 working notes

- Refines the multi-animation selector into the established 36px timeline-control language.
- Enlarges the animation-name field, uses the shared down-chevron icon, and gives the menu an opaque theme-aware input surface.
- Keeps New, Duplicate, and Delete at standard timeline-tool dimensions with compact, even spacing.

## v1.1.0 working notes

- Projects can contain multiple named animations with editable switching, blank creation, duplication, and deletion.
- Legacy single-animation projects migrate into the first animation slot without losing frame data or settings.
- bB export supports the current animation or an all-animation selector library; demos switch animations with joystick Up/Down.
- Timeline thumbnails remain individually selectable after duplicating one or more frames.

## v1.0.5 notes

- Opens a native Save As picker in supported browsers instead of silently downloading projects to the default folder.
- Shares the most recently used project folder between Save and Open, matching YAJA Painter.
- Retains prompt/download and file-input fallbacks when File System Access APIs are unavailable.
- Reduces the centered Animation Name field to 160px at every timeline breakpoint.

## v1.0.4 working notes

- Snaps Circle pivots to the shared center of four pixels when pointer-down occurs near an internal grid intersection.
- Retains the existing single-pixel-center pivot when pointer-down occurs away from an intersection.
- Supports exact half-cell circle symmetry in both the main canvas and Stamp Editor.

## v1.0.3 working notes

- Adds Painter's visible fullscreen icon button to the web and desktop app header.
- Keeps the button theme-aware, keyboard accessible, and synchronized with enter/exit fullscreen state.
- Preserves the native desktop View > Full Screen menu command.

## v1.0.2 working notes

- Makes small circle outlines mirror-symmetric across both axes, including the half-cell ties that previously produced one-sided bulges at odd/even sizes.
- Uses the same corrected aspect-aware circle rasterizer in the main canvas and Stamp Editor.
- Preserves the center-first Circle interaction, fill/outline behavior, active kernel ratio, and NUSIZ-aware geometry.

## v1.0.1 release notes

- Makes Circle visually round across every kernel, Atari pixel aspect, and active NUSIZ mode on both the main canvas and Stamp Editor.
- Keeps every canvas edge reachable at high zoom and tall frame sizes.
- Stacks the header before project/theme controls collide while keeping the title on one line.
- Renames the creative Edit panel to Transform and adds an explicit desktop View > Full Screen command.
- Packages Itch web builds directly from this version with portable ZIP paths and verified local fonts.

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
