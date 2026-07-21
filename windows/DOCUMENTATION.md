# YAJA 2600 Animator Documentation

YAJA 2600 Animator is a pixel-accurate Atari 2600 player-sprite animation editor. It supports Standard, Multisprite, DPC+, and PXE projects, per-frame sprite dimensions, NUSIZ, offsets, timing, colors, reference images, and round-trip YAJA bB interchange files.

## Starting a project

Choose the kernel and display region, then set each frame's Width, Height, NUSIZ, X/Y offsets, and Frame Repeat. Two Sprite Mode adds Sprite B and a second assignment. The canvas, color columns, and timeline update for the active frame.

## Drawing and editing

The Tools panel provides pencil, eraser, line, rectangle, oval, circle, vertical and horizontal triangles, selection, toggle pixels, flood fill, and scanline color painting. Brush width and height also apply to shapes. Right-click erases while drawing.

Selection uses exact pixel masks. Drag selected pixels to move them, use arrow keys for single-cell movement, and use Shift/Ctrl/Command or Alt to add or subtract selected cells. Nudge, scale, flip, and rotation operations are undoable.

## Timeline

PLAY previews the current animation; Loop controls wrapping. Add, duplicate, reorder, reverse, and delete act on selected frames. Shift selects a range, Ctrl/Command adds individual frames, and blank-area dragging creates a marquee selection. Frame Repeat is stored per frame; Apply to All copies it to the animation.

## Animation library

The editable animation control above the timeline switches between animations stored in the same project. Use `+` for a blank animation, Duplicate for a complete copy, and Delete to remove the current animation. Duplicate names advance automatically (`Walk 2`, `Walk 3`, and so on). Kernel, region, background, theme, stamps, and color blocks are shared; frames, sprite mode, assignments, timing, NUSIZ, offsets, colors, and references belong to each animation.

## Colors and reusable assets

DPC+ and PXE frames can use scanline color streams. Standard and Multisprite use solid player colors. Color Blocks and Stamps are editor assets stored in JSON projects; they are intentionally not embedded in bB files.

## Image references

Import one image for the current frame or a naturally sorted sequence. References are stored per frame and sprite slot. Fit mode, opacity, scale, fine X/Y placement, brightness, contrast, threshold, dithering, Auto-Paint, and Auto-Color help translate artwork to Atari pixels and colors.

## Saving and exporting

- **Save** writes a JSON project containing animation data plus editor-only stamps, color blocks, and reference images.
- **Export bB** offers Data Only modules or a Compilable Demo for the current animation or every animation. The all-animation demo starts with the first animation and switches with joystick Up/Down.
- **Import bB** restores generated YAJA animation data and supports partial import from ordinary `player#:` blocks.
- **Export PNG** writes one PNG for a single frame or a ZIP of individual PNGs for multiple selected/all frames.

## Desktop menus

- **File:** new/open/save projects, import/export bB, export PNG, and import references.
- **Edit:** undo/redo and pixel-selection clipboard actions.
- **Animation:** playback and frame commands.
- **View:** grid, color-column, onion-skin, reload, and fullscreen controls.
- **Window / Help:** normal desktop window actions, documentation, and version information.

## Keyboard and pointer notes

- Ctrl/Command+Z: undo
- Ctrl+Y or Command+Shift+Z: redo
- Arrow keys: move a selection or change the active frame
- Escape: exit a selection, cancel an armed asset, or close an editor
- Right-click while drawing: erase
- Shift/Ctrl/Command/Alt: selection modifiers

## bB coordinate contract

Animator uses a bottom-left sprite origin. Generated modules preserve the composition pivot while NUSIZ, frame size, offsets, and timing change. Host movement code changes the shared base X/Y position; the animation module applies per-frame centering and offsets so correctly authored animation does not jump during motion.

All-animation modules use one selected animation runtime to conserve scarce bB variables. The collection exposes namespaced Init, Update, Select, Next, and Previous labels; running multiple characters simultaneously requires host-managed runtime state for each character instance.
