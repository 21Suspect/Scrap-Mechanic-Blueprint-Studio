# Installation

## Windows quick start

Requirements: Windows, a Steam installation of Scrap Mechanic, Node.js 22+, and a browser with WebGL. Internet is needed for the initial npm dependency download. Studio then uses local game files. Close Studio before updating its source/dependencies.

Download the release ZIP, extract it to a writable folder and run `Start-Blueprint-Studio.cmd`. The launcher installs missing dependencies, starts a hidden local Node process, checks startup and opens `http://127.0.0.1:38799`. First startup may take longer while dependencies download. No game binaries or scripts are patched. Launcher logs are in `%LOCALAPPDATA%/BlueprintStudio/logs`.

Manual start, from the extracted folder:

```powershell
npm ci
npm start
```

Keep this terminal open while using Studio; Ctrl+C stops it. Closing a browser tab does not stop the server. With the double-click launcher, the server stays running in the background; use Task Manager to stop the `node.exe` process whose command line is `server.mjs` if needed. Do not stop unrelated Node processes.

## Automatic paths

Studio looks for an enclosing game installation, Steam's registry location, library folders and the Scrap Mechanic app manifest. Profiles are discovered under the current user's AppData. Steam's most recently used account is preferred, or the only game profile if there is one. Launch Scrap Mechanic once before starting Studio.

If multiple profiles remain ambiguous, startup lists them and asks you to configure a destination. This avoids saving into another account's folder.

Create `studio.config.json` beside `server.mjs` only when overrides are needed:

```json
{
  "gameRoot": "D:/SteamLibrary/steamapps/common/Scrap Mechanic",
  "profileId": "YOUR_STEAM_ID"
}
```

Remove keys you do not need. Supported keys: `gameRoot`, `profileId`, `blueprintRoot`, `steamRoot`, `workRoot`. Paths can be absolute or relative to Studio. Environment variables take precedence: `SM_GAME_ROOT`, `SM_PROFILE_ID`, `SM_BLUEPRINT_ROOT`, `SM_STEAM_ROOT`, `SM_WORK_ROOT`. `SM_CONFIG_FILE` selects another configuration file. Never commit your personal configuration.

Drafts, backups and generated files go in `workspace`. If unwritable, Studio falls back to the user's local application-data folder. Captures go in the resolved workspace's `captures` directory. Keep this folder when updating. Game blueprints remain in the game's profile directory.

## Captures and model import

Automated captures and server-side model import use installed Chrome or Edge, then Playwright Chromium as a fallback. If neither is installed:

```powershell
npx playwright install chromium
```

`SM_BROWSER_CHANNEL=msedge` selects a specific installed browser channel. Regular interactive viewing uses your chosen browser.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Node was not found | Install Node.js 22+ and reopen the launcher. Check `node --version`. |
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
