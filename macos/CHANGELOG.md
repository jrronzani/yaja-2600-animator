# YAJA 2600 Animator v1.5.0

## v1.5.0

- Import Data now accepts common labelled Assembly sprite tables in addition to YAJA's round-trip format. It understands familiar byte directives and binary, hexadecimal, and decimal data, then brings the available sprite rows and colors into the editor.

## Major changes since v1.3.4

This release brings the editor, timeline, and two-sprite workflow into a more finished place while keeping existing projects compatible.

### A clearer canvas workspace

- The canvas now stays centered and steady as you zoom, play animations, turn color columns on or off, or work with scrollbars.
- Grid controls are simpler: Grid can be shown or hidden, and its color and opacity live together in a compact settings popup.
- Background color now uses the full Atari color palette in both NTSC and PAL, matching the paint-color picker.
- Canvas clutter has been reduced by removing the dotted workspace pattern and distracting canvas outlines while keeping normal grid edges available.

### Better two-sprite editing

- Sprite A and Sprite B have labels beneath the canvas that show their player assignments. Click a label to switch editing focus, or use its eye control to temporarily hide that sprite while you work.
- Sprite overlap now follows Atari player order everywhere: P0 is always on top, followed by the higher player number. The canvas, thumbnails, preview, PNG export, and generated bB output agree on the result.
- Auto Sprite Select can be turned on when useful, starts off for new settings, and correctly looks through hidden or empty upper pixels.
- NUSIZ copies now grow to the right from their original sprite position, so changing a copy mode no longer pushes the other sprite around.
- In Two Sprite Mode, adding or removing height keeps the sprite anchored at its bottom edge, closer to how Atari sprites behave on screen.

### Reference images, PNGs, and color work

- Auto-Paint and Auto-Color handle transparent images more reliably and can ignore common black backgrounds, avoiding the overly dark colors they could introduce.
- Exported PNGs use Atari-shaped pixels and can be brought back in as a reference with a much closer match to the original grid.
- Fast color-column drags fill every row crossed by the pointer instead of leaving gaps.

### A more useful playback preview

- The canvas includes a small animation preview that plays along with the timeline. It uses the selected background color and shows the same sprite overlap, copy modes, offsets, and scanline colors as the finished animation.
- The preview stays in place while you scroll or zoom the editor. You can drag it anywhere within the canvas, resize its window, adjust its magnification, or hide it when you need more room.
- Its view stays steady across the animation, using the widest and tallest frame so the window does not jump as frames change.

### Import and export data

- The former bB commands are now simply called **Import Data** and **Export Data**. bB remains available for familiar YAJA and batari Basic workflows.
- Export Data can also create DASM-ready Assembly art and color tables for the current animation or the whole project. The Assembly export is deliberately data-only, ready to be used with a scanline kernel.
- YAJA Assembly data can be imported again as a complete project, including multiple animations, frames, timing, colors, player assignments, offsets, and copy modes. Earlier YAJA Assembly tables can also recover their available art and colors.

### Saving, imports, and desktop use

- The toolbar Save command now opens the normal Save As chooser, so it is always clear where a project is being written. The desktop File menu still includes normal Save and Save As commands.
- Project saving guards against accidental double activation, and the desktop file commands remain wired to the same project, import, and export features as the browser editor.
- Project, bB, and PNG export/import paths have been checked across the supported kernels and keep the animation data needed for a reliable round trip.

Existing projects load without changing their artwork or frame order. Older two-sprite layouts are adjusted once when needed so they keep the same appearance under the improved copy positioning.
