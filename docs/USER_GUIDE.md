# User guide

## Drafts and game saves

Use **New draft** for an empty named creation. **Open blueprint** shows game saves and drafts as searchable thumbnail tiles and also accepts blueprint JSON. Deleting a draft moves it to `workspace/deleted-drafts`; it does not delete a game creation.

**Save blueprint** writes into the detected game profile. If the name exists, choose whether to replace it. Confirmed replacement keeps a recovery copy under `workspace/backups`. Validation errors block installation. Save draft and Download JSON are separate actions. Keep your own backups of important creations.

## Editing

Open **Components** beside Inspect. The component list groups matching shapes; expand a group for individual parts. Clicking a block selects one cell even when the original blueprint stores a long cuboid. This splitting is undoable. Shift/Ctrl-click adds selections; double-click selects matching shapes. Body and Assembly expand the selection.

Move using the centered XYZ arrows or exact coordinates. Rotate in 90-degree steps, mirror, copy, delete, replace shapes and change paint. Copies remap internal controller/joint IDs and drop external wiring. Mirrors use valid rotations; asymmetric meshes cannot become true reflected geometry. Check attachment after moving or replacing parts.

**Add block / part** opens the installed asset library. Search names or UUIDs and inspect dimensions and physical metadata. Place blocks and parts, then configure connections and settings. Converted model sections can be separated into a new body for a moving mechanism. Moving bodies still need correctly placed bearings or pistons and supporting faces.

Matching interactive parts can share settings edits while retaining their distinct IDs and wiring. Supported settings include engine gear, bearing reversal, seat steering limits/speeds, suspension stiffness, lights, sensors, gates, timers, thrusters and pistons. Unknown opaque Lua data is preserved rather than fabricated.

## Simulation and validation

Open **Inspect → Simulation**. Mechanisms mode previews prescribed motion. Physics mode adds an independent approximate rigid-body solver. Run starts simulation; Reset/Escape restores the original editing pose. No simulated pose is written into your blueprint.

Switches latch; buttons stay active while held. Their controls appear next to the view selector. Connected lights, logic and timers propagate signals. Sensor rays follow local +Z and detect the nearest creation collision surface; range, color and button/switch modes apply. Terrain, players and animals are not included. Manual sensor overrides last until cleared or reset.

Controller sequence columns run together across rows. Bearing angles accumulate; piston entries are absolute extension lengths, including zero return steps. Later columns stage actions. Once/return and supported loops can be previewed; loaded timing and unrecognized modes still require game testing.

Physics supports gravity, ground, passive bearing chains, engine torque, springs, piston servos, connected-body contacts and separated attachment islands. Choose a body index to anchor a bench test, or -1 for free movement. Engines show simulated RPM; Mechanisms shows commanded RPM. Native fuel/battery consumption is not simulated.

With exactly one driver seat or saddle, **W/S** controls connected engines and **A/D** steering bearings. Forward input powers connected thrusters. Input releases on key-up, window blur and text-field focus. Release recenters steering; native neutral-lock behavior remains approximate. No player mass is automatically added.

Creative thruster force uses installed metadata. Survival force needs supplied measurements or the explicit **Estimate survival thrust** option. Flame visuals use original textures but are not the native particle engine.

**Suspension strength ×** defaults to 2 as an empirical correction to the preview's softness; 1 restores the unscaled table. Seat steering uses an estimated 25000 N·m limit to support stationary steering. These are disclosed calibration values, not native measurements. Other assumptions include density conversion, damping, friction, collision hulls, tire behavior and controller force limits. Aerodynamics and buoyancy are not implemented.

**Check motion** samples mechanical inputs, release, drives and combined cases. Review baseline contacts, collision pairs and incomplete cases; click a collision to replay its pose. Finite sampling is not continuous collision detection or an exhaustive state-space proof.

**Center of mass** combines available density and collision volume. It is approximate unless you provide measurements. Cargo, players and fuel are not inferred. Seven views, X-ray, bounds, body isolation and inspection sheets help check fit and appearance.

Validation audits UUIDs, colors, axis pairs, coordinates, references, joints, wedge limits and positive-area attachment faces. Parts weld only on supported sticky faces; edge/corner contact is not enough. All of this helps find mistakes but does not certify native spawning or eliminate every `Invalid Joint Position`. Always spawn and drive the result in the game.

## Model conversion

Choose **Import 3D model**, select the model and its local textures/materials, then set longest dimension in blocks, up axis, rotation and block material. One block is 0.25 m. Shell fills surfaces; Solid fills enclosed volumes. Open meshes can leak and thin details can disappear at low resolution.

Supported: GLB/glTF, OBJ/MTL, STL, PLY, FBX, Collada/DAE, 3MF and 3DS. Convert Blender/CAD files to one of these first. Draco/Meshopt/KTX2 content needs conversion to uncompressed assets. Remote model dependencies are blocked; include them locally.

Texture, vertex and material colors become paint colors, not transferred texture maps, transparency or PBR shaders. Conversion does not infer doors, interiors, mechanics, rigs, animation or flight. Use the editor to add those afterward. The largest-island option discards smaller islands only when explicitly selected. Add to current preserves the current creation; replacement is undoable before save.

Human imports warn about large resource requirements and allow proceeding. AI imports do not require that acknowledgement. Both remain limited by available memory, browser allocation and game capacity.

## AI workflow

Describe the creation in **AI workshop**, copy the brief and paste it into Codex with the Studio folder available. Studio does not generate through an API itself. Ask for a reproducible recipe, validation, seven-side captures, mechanism tests, motion sweeps and revisions. See [AI & development](AI_AND_DEVELOPMENT.md).
