# Publishing YAJA 2600 Animator

The clean release repository is generated at `.publish/yaja-2600-animator`. Its web, Windows, macOS, and Linux folders all contain the same `index.html`, `index.css`, `app.bundle.js`, source modules, local fonts, and inline SVG controls.

## Web / itch

Upload `Itch Uploads/yaja-2600-animator-web-v1.0.0.zip` as the HTML5 build and enable **This file will be played in the browser**.

## Desktop builds

GitHub Actions provides separate Windows, macOS, and Linux artifacts. Run the **Desktop Release Builds** workflow to create a draft release and populate the platform archives. Download those artifacts into `Itch Uploads` before publishing them on itch.

The desktop shell must not replace renderer controls with Unicode, emoji, OS glyphs, or native toolbar buttons. The native menu sends commands into the same web renderer; all visible app controls continue using the inline SVG symbols in `index.html`.

## Release checklist

- Run `npm ci`, `npm run check`, and `npm run build` in the v1.0.0 source folder.
- Test the localhost build and direct-file Chrome build.
- Test the Electron shell with File, Edit, Animation, View, Window, and Help menus.
- Confirm all three local fonts load without a network connection.
- Confirm project save/open and bB/PNG export use native desktop dialogs.
- Confirm no `tests`, `test-results`, `node_modules`, or developer profiles enter the ZIPs.
- Verify the macOS archive includes `HOW TO INSTALL ON MACOS.md`.
