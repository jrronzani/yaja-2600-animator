# How to Install YAJA 2600 Animator on macOS

The macOS build is ad-hoc signed, but it is not notarized with an Apple Developer ID. macOS may therefore ask you to confirm that you trust the app.

1. Download and unzip the macOS package.
2. Drag `YAJA 2600 Animator.app` into Applications.
3. Control-click the app, choose **Open**, then choose **Open** again.

If macOS still says the app cannot be opened or is damaged, download it again from the official YAJA itch page, then run this command in Terminal:

```sh
xattr -dr com.apple.quarantine "/Applications/YAJA 2600 Animator.app"
```

Control-click the app and choose **Open** once more. Only remove quarantine from a copy downloaded from the official YAJA release page.
