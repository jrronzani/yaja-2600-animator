# YAJA 2600 Animator v1.5.0

The v1.5.0 release is the finalized milestone since v1.3.4. See [CHANGELOG.md](CHANGELOG.md) for the release notes.

## v1.5.0 working notes

- Import Data now accepts common hand-written Assembly sprite tables as well as YAJA Assembly exports. It recognizes labelled sprite and color data written with `.byte`, `BYTE`, `.db`, `dc.b`, or `fcb`, using binary, hexadecimal, decimal, or `0x` byte values.
- YAJA manifests remain the complete round-trip format. Ordinary tables bring in the sprite rows and color stream that they contain, leaving unavailable editor settings at safe defaults.
- This stays focused on player-sprite data. Playfield table packing belongs in YAJA Painter, where PF0, PF1, PF2, mirroring, and playfield layers can be handled correctly.
## v1.4.32 working notes

- Arrow-key movement of a selected sprite now follows the Transform panel's Pixels and Colors choices.
- Height changes add blank rows at the top and preserve the sprite's bottom anchor, so a character's feet stay in place.
- Resizing the playback preview changes only its viewing window; art stays centered at the selected preview zoom.

## v1.4.31 working notes

- Import Data now restores YAJA Assembly exports, including complete multi-animation exports through a DASM-safe comment manifest. Earlier raw YAJA Assembly tables recover art and scanline colors with editor defaults for data that was never exported.
- The Import Data examples now include YAJA Assembly format, and the playback preview hide control uses the same theme button surface as other compact controls.

## v1.4.28 working notes

- Playback preview framing now uses each sprite’s configured grid dimensions, including blank rows and columns. Drawing the first pixels into a frame no longer shifts the preview.

## v1.4.27 working notes

- Renames the bB toolbar and desktop menu entry points to **Import Data** and **Export Data**.
- Export Data now offers a bB/Assembly format choice. Assembly exports DASM-compatible bottom-up art and named scanline-color tables for the current animation or the complete project; it deliberately contains no runtime kernel.
- The original Import Data entry point began as the bB importer; it now also accepts YAJA Assembly and common labelled Assembly sprite tables.

## v1.4.26 working notes

- Adds a smaller draggable playback thumbnail that stays pinned to the canvas viewport while the editor canvas scrolls or zooms. It renders every sprite pixel, NUSIZ copy, offset, and layer in the editor composition.

- The frame and selected-sprite size readout is docked to the bottom of the canvas viewport above its horizontal scrollbar.
- The size readout now shows only the selected sprite dimensions; the redundant two-sprite `2 x` prefix is removed.
- Sprite A/B canvas labels select the matching edit slot from their text area while their eye buttons remain visibility-only controls.
- Inactive sprite labels use the same darker surface as the frame/size readout.
- NUSIZ copies and width expansion extend right from stable primary-sprite anchors without pushing the other primary sprite.
- Schema 14 migrates older adjacent compositions once to preserve their existing appearance under the corrected anchor model.

- Selected Sprite A/B canvas labels now use the active theme highlight.
- Timeline thumbnails follow the same assigned-player layer priority as the editing canvas.
- Paint-palette selection is an inset outline around the actual Atari color.
- Save reuses the current browser handle or desktop path and rejects overlapping save requests.
- Canvas centering and zoom use the sprite composition alone; labels, color columns, readouts, and scrollbar changes no longer shift it.
- Timeline frames display from 1 and report the complete animation duration in seconds.

- Added a default-on **Ignore Black Background** reference option shared by Auto-Paint and Auto-Color.
- Auto-Color now rejects opaque near-black background pixels and low-strength antialias blends before averaging a scanline color.
- Transparent PNG pixels remain excluded from both shape and color extraction.
- PNG frames now use tight 17×10 Atari-aspect cells, allowing an exported single sprite to map back onto the same reference grid without padding or aspect drift.

- Interpolates fast scanline-color drags so every crossed row receives the selected Atari color.
- Audits every desktop menu command and file bridge, and adds state-synchronized checkbox items for Two Sprite Mode, Grid, Color Columns, and Onion Skin.
- Restores the visible Atari background layer in one- and two-sprite editing modes.
- Uses one device-aligned cell size for both sprite canvases so offset overlaps share exact grid coordinates.
- Keeps saved Auto Sprite Select choices while a fresh preference state starts unchecked.
- Stacks sprite labels when their natural positions touch, with the top-rendered player's label first.
- Restores the Grid perimeter at the same color, opacity, and line thickness as the internal cell edges.
- Keeps active-sprite outlines, canvas borders, focus rings, and canvas shadows removed.
- Replaces the Stamp tool artwork with a simple filled stamp silhouette.
- Removes canvas focus and active-slot edge treatments from every canvas layer.
- Renders BG once beneath transparent sprite canvases so upper blank cells cannot cover lower sprite pixels.
- Uses assigned player order for overlaps: P0 is always highest, then higher player numbers.
- Auto Sprite Select defaults off and passes through hidden or empty upper sprite cells to live pixels below.

- Refreshes the frame dimension readout whenever button selection or Auto Sprite Select changes the active sprite.

- Removed workspace dots and all CSS canvas outlines while retaining optional grid-edge lines.
- Renamed Grid Intensity to Opacity and tightened the Sprite Settings layout.
- Added temporary per-sprite visibility controls to dynamic labels beneath both canvases.
- Two-sprite height changes now preserve the bottom edge and the position of retained artwork.

- Removed the distracting active-sprite canvas rings in Two Sprite Mode; the Sprite A/B buttons now carry selection state.
- Replaced the Stamp tool's duplicate-pages glyph with a dedicated rubber-stamp icon.

- Background color selection now uses the same labeled Atari palette grid and inset selection ring as paint-color selection in NTSC and PAL.
- Two-sprite active-canvas feedback is drawn in a dedicated top overlay so it always marks the actual active sprite, including overlapping sprites.
- The open Grid Appearance control uses the same theme accent outline as other selected controls.

- Auto Sprite Selection is integrated with the Sprite A/B selector and can be disabled for manual canvas-tool locking.
- Grid color and intensity open from the small disclosure beside Grid; Dots independently controls the workspace pattern.
- Kernel is the leftmost canvas-toolbar section; the canvas controls follow with the Atari BG palette, Grid, Dots, Colors, and Zoom.
- Grid appearance uses a compact color/intensity popup with a consistent RESET button; BG uses the official Atari palette popup.
- Undo and Redo are labeled actions, and color columns remain visible whenever Colors is enabled.
- Kernel dropdown text now follows the established compact `.7rem` control sizing.

- Removed project-background fill from the spaces between hardware copies in Single Sprite Mode.
- Background painting now follows NUSIZ copy geometry consistently in both one- and two-sprite compositions.

## v1.3.3 working notes

- Restored the Painter-matched fixed 24px player-color columns after the wider 28px regression.
- Added sparse-art browser QA coverage for double/triple NUSIZ backgrounds, transparent copy gaps, and separated outlines.

## v1.3.2 working notes

- Restored the project background beneath every visible NUSIZ hardware copy while keeping the copy-spacing gaps transparent for two-sprite composition.
- Removed the single active outline that connected duplicate copies; each copy keeps only its own grid boundary.
- Simplified NUSIZ technical labels to the `$00`–`$07` register notation.

## v1.3.1 working notes

- Shows each NUSIZ mode's lower-three-bit binary and hexadecimal register value beside its friendly name.
- Rebuilds Two Sprite Mode as a transparent composition so hardware-copy gaps never obscure the other sprite.
- Gives Sprite A and Sprite B independent width and height while keeping legacy projects compatible.
- Keeps negative-offset sprites, color columns, and scroll bounds reachable, with Sprite B adjacent to Sprite A's complete NUSIZ span by default.

## v1.3.0 working notes

- Adds all eight hardware NUSIZ player modes, including synchronized double- and triple-copy editing.
- Makes every displayed hardware copy directly editable while retaining one bitmap per sprite frame.
- Updates two-sprite composition, thumbnails, stamps, PNG output, import/export metadata, and centering for complete NUSIZ spans.

## v1.2.9 working notes

- Adds the supplied YAJA 2600 Animator mark as the browser-tab icon and the canonical desktop package icon source for Windows, macOS, and Linux.

## v1.2.8 working notes

## v1.2.8 working notes

- Selection rectangles and moved selections continue tracking outside the canvas while clamping to its nearest edge.
- The selection context is a compact two-column panel in the lower-left of the canvas workspace and no longer covers the center of the sprite.
- Crop to Selection clears pixels outside the selected bounds on the active sprite only, including in Two Sprite Mode.

## v1.2.7 working notes

- Renamed the import dialog to `Import bB Data`.
- Renamed the dialog action to `Import bB` to match the toolbar control.

## v1.2.6 working notes

- Enlarged the Import bB dialog just enough for the complete ordinary/YAJA example to fit without a textarea scrollbar at desktop sizes.
- Added root-level validation artifacts for lean/full import fidelity and moving NUSIZ-centering ROM compilation.

## v1.2.5 working notes

- Matched the ordinary and YAJA import examples by separating sprite pixels and scanline-color tables with a blank line.

## v1.2.4 working notes

- Simplified Import bB to a single Painter-style text area with ordinary bB and YAJA project-data examples.
- Complete project-data exports round-trip frames, repeats, NUSIZ, offsets, assignments, pixels, and colors.
- Lean and ordinary bB imports recover the first readable one- or two-sprite frame and its available color data without unnecessary warnings.
- Added solid-kernel frame-color recovery and strict, atomic errors for malformed YAJA metadata.

## v1.2.3 working notes

- Classic Light primary buttons now darken subtly on hover while remaining blue.

## v1.2.2 working notes

- Download `.bas` now uses the active theme's primary action color in the export dialog.

YAJA 2600 Animator is a browser and desktop creative tool for authoring Atari 2600 player-sprite animations and exporting round-trip batari Basic data or compilable demos.

## v1.2.1 working notes

- Harmonizes Classic Light hover colors with Painter so blue theme actions remain blue instead of changing to orange.
- Wraps YAJA bB project metadata into compiler-safe comment lines, with a semicolon on every exported line.
- Rewords positioning choices and variable-use summaries in clearer, user-facing language.

## v1.2.0 working notes

- Replaces the displayed NTSC and PAL colors with Stella Standard RGB mappings shared by every editor, preview, reference, and export surface.
- Adds reversible NTSC/PAL color banks so each region remembers its exact project colors without repeated conversion drift.
- Displays all 128 NTSC choices and the 104 canonical PAL choices while continuing to load every PAL `$XX` value.
- Advances Animator projects to schema 11 and migrates older PAL projects once from the former YAJA palette appearance.

## v1.1.23 working notes

- The desktop toolbar Save button now always opens Save As while native Save and Save As shortcuts retain their conventional behavior.
- bB export now offers Tables Only, Animation Module, and Compilable Demo profiles with optional project metadata, explanatory comments, and two positioning approaches.
- Generated variables use ordinary names, labels retain double underscores, and the default module uses only the Frame and Timer variables.
- PXE demos omit Standard-only TV and score directives, and thumbnail timing is again shown as `x#`.

## v1.1.22 working notes

- Targets brush and stamp hover feedback to the sprite canvas currently under the pointer in Two Sprite Mode.
- Keeps click-to-activate behavior while preventing hover previews from appearing on the previously active sprite.

## v1.1.21 working notes

- Preserves relative NUSIZ scale in two-sprite timeline thumbnails.
- Automatically activates whichever visible sprite receives a canvas tool action.
- Refreshes thumbnails immediately after scanline recoloring.
- Clarifies Sprite Offsets, repeat labels, and compact two-sprite transfer actions.
- Adds an optional `Export with project data` interchange layer; lean bB is now the default.
- Harmonizes export format/scope layout and suppresses non-actionable info banners.

## v1.1.20 working notes

- Centers every export-dialog action label vertically, including `Download .bas`, using Painter's 36px inline-flex button treatment.
- Moves PXE and DPC+ compilable-demo `bkcolors:` scanline data to the bottom of the generated source so executable animation code is easier to reach.
- Keeps Standard and Multisprite `COLUBK` setup near the top because those kernels use a compact register assignment rather than a full scanline table.

## v1.1.19 working notes

- Canvas eyedropper picks the visible sprite color and immediately updates the palette, swatch, and color field.
- Web Save opens the native file picker with `<Project Name>.json`, matching YAJA Painter, without an extra filename prompt or Animator suffix.

## v1.1.18 working notes

- Matches Painter's full-width Hue Offset and Lightness Offset controls in the Color Block Editor.
- Stamp previews use the same uniform Atari pixel-aspect, kernel-stretch, and current-frame NUSIZ fitting as timeline thumbnails.
- Space toggles animation playback outside text-entry controls; Ctrl/Cmd+C, X, V, Z, Y, Shift+Z, and Shift+R follow standard edit behavior.
- Timeline multi-selection now targets all selected frames for Transform and per-frame Sprite Settings commands as one history action.

## v1.1.17 working notes

- The animation picker displays four animation rows at a time and scrolls for larger libraries.
- Timeline previews now render Normal, Double, and Quad NUSIZ widths accurately.
- NUSIZ-aware previews retain uniform X/Y fitting and the kernel-specific Atari pixel ratio.

## v1.1.16 working notes

- Timeline frame previews now use the same Atari 1.7 pixel aspect and kernel-specific vertical stretch as the main canvas.
- Preview sprites are letterboxed and centered without independent horizontal or vertical CSS scaling.
- Frame width and height are respected in preview rendering, including two-sprite layouts.

## v1.1.15 working notes

- Replaces CSS-pixel-only canvas rounding with one device-pixel-aware backing-store geometry shared by pixels, grid lines, and brush feedback.
- Removes the 4/4 midpoint seam at fractional browser/display scaling without changing the original one-cell ghost design.

## v1.1.13 working notes

- Aligns every canvas grid stroke to the same rounded cell boundary used by raster rendering, eliminating the faint fractional center grid line.
- Draws selection, stamp, and brush ghost feedback above the grid so every hover outline remains complete around its cell.

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
