# AI and development

## Local workflow

Use this repository as the Codex project and read `AGENTS.md`. No API keys are needed. The AI workshop copies a detailed brief containing actual project paths, construction rules and validation steps. Reasoning runs in the user's existing session; Studio does not execute hidden AI requests.

```powershell
npm ci
npm start
# In another terminal:
npm run demo
node capture.mjs --draft "Kinetic Array"
node capture.mjs --draft "Kinetic Array" --connections
```

The demo writes a draft, not a game save. Captures and reports are stored under the resolved workspace. Chrome/Edge or Playwright Chromium is needed for automated capture. Inspect all seven images and asset/browser failures before delivering a creation.

## Reproducible builders

Import `BlueprintBuilder` from `lib/builder.mjs`. Use `body`, `part`, `centered`, `joint`, `connect`, `build` and `save`. Search `catalog` in `lib/assets.mjs` for installed UUIDs and actual definitions. See `examples/demo.mjs` and the larger aircraft/tractor recipes. Examples are source recipes; generated drafts and imported user creations are not distributed.

Shape positions are oriented corners. Use the 24 proper `ROTATIONS`, centered placement, native dimensions and transformed sticky faces. Joint cell corners need `jointAnchor`/`jointOrigin`; use builder/editor helpers for flattened indices and reciprocal links. Native wedge dimensions are limited to 8 per local axis. `wedgePieces` splits larger forms with reported slope rounding. `weldBlockVolumes` resolves overlapping block cuboids.

Retain controller IDs and opaque data. Use engine gear helpers, explicit piston/controller settings and tested native templates. `lib/paths.mjs` owns filesystem discovery; never introduce usernames, Steam accounts or personal blueprint defaults into runtime code.

## Browser APIs

Available on `window.studio` in the running viewer:

```js
studio.setInput(id, true);        // switch/button or manual sensor override
studio.setInput(id, false);
studio.setInput(sensorId, null);  // restore automatic sensing
studio.advance(1);               // deterministic preview step, pauses real-time playback
studio.simulation();             // states, sensors, motors, poses, limitations
studio.simulate(false);          // reset
studio.physics({ground:true, fixedBody:-1, suspensionStrength:2});
studio.drive({throttle:1, steering:-1}); // one driver seat/saddle required
studio.drive({});
studio.driveEngine(id, {power:1, gear:4});
await studio.checkMotion();
studio.mass();
studio.partPose(index);
```

Other interfaces include `studio.place`, the editor API, model import, view selection, contact sheets, connection states, lights and collision replay. Inspect implementation and returned reports before relying on an undocumented field. Engine direction, sensor scheduling and calibration are not native-engine certification.

## HTTP and MCP

The loopback server exposes catalog, creations, validation, draft/save operations, mass, motion preview, collision sweeps, physics, part templates and model conversion. Inspect `server.mjs` for schemas. `/api/physics` accepts `{blueprint,time,inputs,engines,driver,events,options}`. Events can change inputs/engines/driver at specific times. Simulation is transient; game installation uses the separate save operation and replacement confirmation.

Run `node mcp.mjs` for the optional stdio MCP server. Example Codex configuration; replace the path:

```toml
[mcp_servers.scrap_blueprints]
command = "node"
args = ["C:/path/to/BlueprintStudio/mcp.mjs"]
```

Tools cover creation listing/reading, shape search, rotations, validation, draft saving, capture, installation, mass, controller preview, collision sweeps, physics, part templates and model import. The HTTP server must be running for browser-dependent capture/import tools. MCP does not provide an AI model.

```powershell
node import-model.mjs "C:/Models/model.glb" --name "Imported model" --size 128 --up Y
```

Keep the source and dependencies together. Optional `--solid`, `--no-colors`, `--largest`, `--block UUID`. Reports retain conversion settings and limitations. Use only models you have permission to use.

## Tests

`npm test` runs portable path-discovery, sensor and clocked-logic tests without requiring proprietary assets. GitHub CI runs these on Windows and Linux with Node 22 and 24, plus JavaScript syntax checks.

`npm run test:integration` runs the full local suite and requires a game installation. Some historical regression cases require the author's private reference drafts/game blueprints and therefore cannot run on a fresh checkout; these are not bundled. Generate the named recipe drafts for recipe-specific cases. Browser test scripts also require the server, a browser and any named reference creation. Do not report missing fixtures as passing tests or commit private fixtures just to satisfy them.

The model-import fixtures under `tests/fixtures/model-import` are small synthetic test geometry, not extracted game meshes. For physics changes, test both unloaded and loaded behavior, release/return, saved-data preservation and the actual browser path. Keep approximation warnings visible.

## Releases

Source archives contain source, documentation and synthetic fixtures. The Windows installer additionally bundles licensed runtime dependencies and its capture browser. Never include `workspace`, `captures`, personal configuration, tokens, game assets or user blueprints. Optional source ZIPs exclude `node_modules`; npm installs dependencies on the destination computer. `git archive` can reproduce an archive from the tagged source. Publish a SHA-256 checksum alongside it. Tag versions only after the portable suite, available integration checks, fresh installation and package review pass.

## Build the Windows installer

On Windows with Inno Setup 6 and the .NET Framework C# compiler installed:

```powershell
./installer/Build-Installer.ps1 -Compiler C:/path/to/ISCC.exe
```

The script stages only source files, downloads a pinned SHA-256-verified official Node.js runtime, runs `npm ci`, bundles the Playwright headless browser, runs portable tests with the bundled runtime, compiles the desktop launcher and builds `dist/BlueprintStudio-Setup-0.2.0.exe` plus its checksum. Build downloads require internet. No private workspace, game assets or personal configuration are included. Unlike source archives, the installer intentionally includes runtime dependencies. The resulting installer is unsigned.

Installed user data lives separately from application files; preserve that separation when changing the installer or uninstaller. Test clean install, desktop launch, update, bundled capture browser and uninstall with data preservation before publishing.
