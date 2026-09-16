# Publishing YAJA 2600 Animator v1.5.0

The approved release source is `v1.5.0_clean_milestone`.

## Web / Itch

Build the web ZIP directly from this folder. It must place `index.html`, `index.css`, `app.bundle.js`, and `assets/` at its root, with POSIX `/` entry paths. Upload it to Itch as the HTML5 build and enable **This file will be played in the browser**.

## Desktop packages

GitHub Actions builds the Windows x64, macOS, and Linux x64 archives from the matching platform sources. The native menu must continue to send commands through the same renderer UI; do not substitute system glyphs for inline application controls.

## Release checks

- Run `npm ci`, `npm run check`, `npm test`, and `npm run build` here.
- Run the root regression suite.
- Confirm local fonts load without a network connection.
- Confirm project save/open and Data/PNG export use native desktop dialogs.
- Exclude development folders and dependencies from release ZIPs.
- Include `HOW TO INSTALL ON MACOS.md` in the macOS package.
