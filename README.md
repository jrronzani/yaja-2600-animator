# YAJA 2600 Animator v1.1.20

YAJA 2600 Animator is a browser and desktop creative tool for creating Atari 2600 player sprite animations and exporting batari Basic data to pasted into game code or a demo code file for easily compiling into rom previews to view how animaions will look on an emulator or real hardware.

It is the third application in the YAJA creative suite for the Atari 2600 homebrew community, joining YAJA Painter for background artwork and YAJA Composer for music. The suite makes creating Atari games less technical and more intuitive while preserving hardware-aware control.

## Built with OpenAI Codex and GPT-5.6

YAJA 2600 Animator was developed through an extended human–AI collaboration using OpenAI Codex with GPT-5.6. Codex worked directly with the real local project, browser, tests, Atari toolchain, and versioned source folders rather than generating a one-time prototype.

Codex and GPT-5.6 helped us:

- Translate detailed design feedback and browser annotations into focused implementation passes.
- Port proven interactions from YAJA Painter and Composer while keeping the suite visually consistent.
- Design and refactor the project model, raster tools, timeline, selection engine, reference-image workflow, and responsive interface.
- Build kernel-aware Standard, Multisprite, DPC+, and PXE batari Basic export and round-trip import systems.
- Diagnose pixel-aspect, rotation, NUSIZ-centering, two-sprite composition, and scanline-color problems.
- Run automated tests, compile generated Atari programs, inspect browser behavior, and package web and desktop releases.

The human creator directed the product, visual language, Atari behavior, and acceptance criteria. Codex accelerated implementation, testing, debugging, and documentation while each change remained subject to hands-on review and iteration.

## What it does

- Draws and colors hardware-aware Atari 2600 sprites.
- Animates frame timing, dimensions, offsets, NUSIZ, and scanline colors.
- Supports one- and two-sprite compositions, onion skinning, stamps, color blocks, and image references.
- Exports PNG frames, reusable batari Basic animation data, or compilable demonstration programs.
- Re-imports YAJA-generated bB code to reconstruct editable animation projects.

## v1.1.20 release notes

- Vertically centers the Download `.bas` action to match YAJA Painter's export controls.
- Moves DPC+ and PXE scanline background tables to the end of compilable exports while retaining compact register-based background setup near the top for Standard and Multisprite.

## v1.1.17 release notes

- Adds a four-row scrolling animation picker for projects with multiple animations.
- Makes timeline previews accurately display Normal, Double, and Quad NUSIZ widths while preserving Atari pixel aspect and kernel stretch.

## v1.1.12 release notes

- Fixes Fill so left-click fills connected empty canvas pixels, while right-click erases connected painted pixels.
- Adds connected color-run Fill in the scanline color columns.
- Locks palette swatches to their grid cells, eliminating hover overlap and active-row flicker.

## v1.1.9 release notes

- Reflows the animation picker with the timeline heading, preserving its title-row placement until a clean dedicated row is necessary.
- Prevents responsive picker/title changes from overlapping playback and frame controls.

## v1.1.8 release notes

- Finalizes the multi-animation project workspace, themed animation picker, and continuous raster stroke interpolation.
- Uses Chrome-safe, full four-edge theme focus rings for Project and Theme fields.
- Packages the matching web, Windows, macOS, and Linux desktop builds from one verified source version.

## v1.0.5 working notes

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
