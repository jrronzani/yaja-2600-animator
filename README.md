# YAJA 2600 Animator

YAJA 2600 Animator is an Atari 2600 player-sprite animation editor for the web, Windows, macOS, and Linux.

- `web/v0.075`: itch/GitHub Pages web build
- `windows`: Electron Windows portable source
- `macos`: Electron macOS portable source and unsigned-app instructions
- `linux`: Electron Linux AppImage source

All four builds use the same renderer, locally bundled fonts, and inline SVG tool icons. The native desktop menu calls into the renderer without replacing its controls.

See [the full documentation](web/v0.075/DOCUMENTATION.md) for tools, timeline behavior, image references, project files, and bB export/import.

## Desktop builds

Run **Build Desktop Apps** in GitHub Actions for downloadable artifacts, or **Desktop Release Builds** for a draft GitHub release containing all platform ZIPs.
