# Publishing YAJA 2600 Animator

The 1.1.9 release is staged directly from `v1.1.9_timeline_picker_responsive_flow`.

## Web / itch

Upload `Itch Uploads/yaja-2600-animator-web-v1.1.9.zip` as the HTML5 build and enable **This file will be played in the browser**. ZIP entries must use `/` separators and expose `index.html`, `index.css`, `app.bundle.js`, and `assets/` at the archive root.

## Desktop builds

Local Windows, macOS, and Linux packages are built from the same verified version folder. Native macOS/Linux launch testing still requires their respective operating systems before public release.

The desktop shell must not replace renderer controls with Unicode, emoji, OS glyphs, or native toolbar buttons. The native menu sends commands into the same web renderer; all visible app controls continue using the inline SVG symbols in `index.html`.

## Release checklist

- Run `npm ci`, `npm run check`, and `npm run build` in the v1.1.9 source folder.
- Test the localhost build and direct-file Chrome build.
- Test the Electron shell with File, Edit, Animation, View, Window, and Help menus.
- Confirm all three local fonts load without a network connection.
- Confirm project save/open and bB/PNG export use native desktop dialogs.
- Confirm no `tests`, `test-results`, `node_modules`, or developer profiles enter the ZIPs.
- Verify the macOS archive includes `HOW TO INSTALL ON MACOS.md`.
