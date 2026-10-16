# Installation

## Windows quick start

Requirements: Windows 10/11 x64, Scrap Mechanic installed through Steam and a WebGL-capable browser. Launch the game once to create your profile.

Download `BlueprintStudio-Setup-0.2.0.exe` from [Releases](https://github.com/21Suspect/Scrap-Mechanic-Blueprint-Studio/releases/latest), open it and click **Install**. It installs for your Windows account without administrator access and creates desktop and Start-menu shortcuts. Node.js, npm dependencies and the headless capture/import browser are included; no dependency download or terminal command is needed during installation.

Start **Blueprint Studio** from your desktop. It opens your default browser. Closing the browser leaves the local server running; use **Stop Blueprint Studio** in the Start menu to stop it. The launcher reuses its own running server and chooses a free port between 38799 and 38819 if another application uses the usual port.

The installer is unsigned, so Windows may display an unknown-publisher or SmartScreen warning. Download only from this project's releases and compare the supplied SHA-256 checksum if needed.

### Updates and uninstall

Save unsaved edits before running a newer installer. Install over the existing version to update. Uninstall through **Settings > Apps > Blueprint Studio**, or **Uninstall Blueprint Studio** in the Start menu.

- Application: `%LOCALAPPDATA%/Programs/BlueprintStudio`
- Drafts, backups and captures: `%LOCALAPPDATA%/BlueprintStudio/workspace`
- Optional configuration: `%LOCALAPPDATA%/BlueprintStudio/studio.config.json`
- Startup log: `%LOCALAPPDATA%/BlueprintStudio/logs/desktop-server.log`

Updates and uninstall preserve this separate data directory and your game's blueprints. Old ZIP/source workspaces are not automatically migrated: keep the old folder and import its draft JSON files, or set `SM_WORK_ROOT` to that workspace before launching.

### Optional source installation

Developers can instead install Node.js 22+, download the source, and run `Start-Blueprint-Studio.cmd`, or run `npm ci` followed by `npm start`. This route downloads dependencies and does not use the installed application's private runtime. Keep the terminal open when using `npm start`; Ctrl+C stops it.

## Automatic paths

Studio looks for an enclosing game installation, Steam's registry location, library folders and the Scrap Mechanic app manifest. Profiles are discovered under the current user's AppData. Steam's most recently used account is preferred, or the only game profile if there is one. Launch Scrap Mechanic once before starting Studio.

If multiple profiles remain ambiguous, startup lists them and asks you to configure a destination. This avoids saving into another account's folder.

For the installer, create `%LOCALAPPDATA%/BlueprintStudio/studio.config.json` when overrides are needed. Source users create `studio.config.json` beside `server.mjs`:

```json
{
  "gameRoot": "D:/SteamLibrary/steamapps/common/Scrap Mechanic",
  "profileId": "YOUR_STEAM_ID"
}
```

Remove keys you do not need. Supported keys: `gameRoot`, `profileId`, `blueprintRoot`, `steamRoot`, `workRoot`. Paths can be absolute or relative to Studio. Environment variables take precedence: `SM_GAME_ROOT`, `SM_PROFILE_ID`, `SM_BLUEPRINT_ROOT`, `SM_STEAM_ROOT`, `SM_WORK_ROOT`. `SM_CONFIG_FILE` selects another configuration file. Never commit your personal configuration.

Source-install drafts, backups and generated files go in `workspace`. The desktop launcher defaults to the separate AppData workspace above; use `SM_WORK_ROOT` to override that default. If unwritable, Studio falls back to the user's local application-data folder. Captures go in the resolved workspace's `captures` directory. Keep this folder when updating. Game blueprints remain in the game's profile directory.

## Captures and model import

Automated captures and server-side model import use installed Chrome or Edge, then Playwright Chromium as a fallback. The Windows installer bundles the fallback browser. Source users without either browser can install it with:

```powershell
npx playwright install chromium
```

`SM_BROWSER_CHANNEL=msedge` selects a specific installed browser channel. Regular interactive viewing uses your chosen browser.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Bundled runtime missing | Run the installer again. Source users need Node.js 22+. |
| Game was not found | Verify Steam installation or configure `gameRoot`. |
| No profile / ambiguous profile | Launch the game once; configure `profileId` or `blueprintRoot` if needed. |
| Dependency installation failed | Run `npm ci` in a writable folder with network access. Do not omit dev dependencies; automation uses Playwright. |
| Port already in use | Stop the old Studio server or set `PORT` to another free port before launch. |
| Black viewport or WebGL failure | Enable browser hardware acceleration and update the graphics driver; try another WebGL-capable browser. |
| Changes do not appear | Save your edits, restart the server if backend code changed, then refresh the browser. |
| Missing models or unsupported parts | Confirm the game install is intact. Mod catalogs are not currently indexed. Include the asset-failure report when reporting a bug. |
| Huge model conversion stalls | Reduce resolution or import a section. Removing application caps does not remove RAM/GPU limits. |

The server binds to loopback and rejects cross-origin writes. Do not expose it publicly or through port forwarding: it is a local file-editing tool, not an authenticated hosting service. Only import models and run builder recipes you trust.

Linux Steam/Proton paths are recognized, but Windows is the tested platform. There is no native Linux/macOS installer or cross-platform parity claim.
