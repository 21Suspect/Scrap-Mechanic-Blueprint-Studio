# Blueprint generation workflow

This is a local tool for Scrap Mechanic. Read README.md before generation. Use the existing Codex conversation for AI reasoning; do not add API clients or API keys.

1. Read the request and choose measurable dimensions, functions, colors and mechanical layout. Search the live catalog in lib/assets.mjs for real UUIDs and collision sizes. Read the selected part's source shape definition and script when controller behavior matters.
2. Generate a reproducible .mjs recipe using BlueprintBuilder in lib/builder.mjs. Save it in examples or a named recipe directory. Generate larger designs with loops and modules rather than token-heavy literal JSON. Preserve opaque controller data when adapting an existing working template.
3. Use centered() or explicit oriented corner coordinates. Use joint() to maintain flattened child indices and reciprocal references. Never invent an axis pair: use one of the 24 ROTATIONS in lib/geometry.mjs. Native rotationSet entries are placement presets; they are not a restriction to four serialized orientations.
4. Use transformBlueprint() for entire assemblies; it corrects joint cell corners. Do not rotate joint posA/posB like part positions. Do not merge bodies across joints.
5. Run validation. Correct errors before saving. Warnings and engineVerified:false are meaningful and must be reported, not removed or ignored to claim success.
6. Start the local server with npm start if needed. Run node capture.mjs --draft "Name". Inspect workspace/captures/Name/sheet.png and the individual images with image viewing tools. Also capture --connections for functional builds. Look at ALL seven sides, alignment, occlusion, paint, and wiring. Revise and repeat until the user request is met; passing static validation alone is insufficient.
7. Check workspace/captures/Name/report.json for asset failures and browser errors. Do not pass off fallback boxes as original meshes. After final iteration, leave the selected draft open for the user. Install only via installDraft() or the UI. A new name creates a fresh UUID. Name collisions return confirmation candidates; replacement requires the user’s explicit confirmation and keeps a recoverable backup.

Do not promise arbitrary/unlimited complexity, exact game physics, engine shader parity, or a universal absence of Invalid Joint Position. The native game is the final authority. Unsupported joint types and hull contact need a spawn test; this tool does not run the native engine. Keep native game assets read-only. Keep existing blueprints read-only unless the user has explicitly confirmed replacement of that specific creation.

Generation/editing corrections from native tractor testing:
- Check `report.attachments.disconnected` and fix every unintended separate group before delivering a generated creation. Face overlap must have positive area; diagonal edges/corners never attach. Top/bottom face attachment is valid.
- Respect both shapes' transformed local `sticky` directions, including when mounting bearings. Horn/switch/seat mounting faces are local -Y, not automatically world -Z.
- Avoid intersecting block cuboids. `weldBlockVolumes()` resolves recipe block overlaps and rebinds joint supports before validation. It leaves native parts untouched.
- The tractor's downward steering bearing axes require seat-link `reverse:1`, established by the user's native drive test. Keep level-5 angle/speed fields tied to the same joint IDs. Native seat speeds use `(1 / radians(27) / 3) * step` for steps 1–10 (Seat.lua).
- Do not invent opaque controller state. The editor supports observed native scalar fields and the known saved engine gear byte; preserve all other bytes and report unsupported formats.

Further editor/generation rules:
- Native resizable wedges must not exceed 8 blocks on any local axis. Use `wedgePieces()` for longer forms and disclose profile rounding; do not render an illegal large wedge and assume the game will accept it.
- FBX UVs for wheels, sensors, lights, thrusters and small pipes must remain unchanged. Only verified OGRE pipe/plate assets receive the V-origin correction. Test and inspect asset-specific changes before extending that set.
- Use `calculate_center_of_mass` / `/api/mass` to inspect weight distribution, and `preview_controller_motion` / `/api/preview` for cumulative controller steps. These are analytical/kinematic tools; preserve their uncertainty and physics:false reports. Never treat them as a native spawn, physics or precise COM certification.
- Native controller frame targetAngle values are incremental: accumulated steps, with reversal, determine the final bearing angle. Trailing zero steps are unused padding for preview; validate unusual sequences in the game.
- Input preview is transient. Keep serialized blueprint poses, controller state and opaque data intact when testing; Reset preview or Escape restores the editing pose.

- Engine preview must use installed script metadata. Gas-engine gears change torque while the upgraded target speed remains 74.074074 rad/s; electric gear velocities are converted from the script’s math.rad values and power ramps at 4.5/s. Commanded speeds are not actual loaded speeds. Preserve native gear, fuel and opaque storage when testing.
- Controller gear parsing may find the typed gearIdx byte in either field order within the decompressed LUA payload. Patches must preserve every other decoded byte; unknown or ambiguous formats stay unsupported.
- Headlight glow textures store an inverse alpha mask with black RGB; treating them as diffuse color or ordinary alpha creates black/white rectangles. Preserve FBX UVs and use the native mask and pose mesh.

Further motion and generation rules:
- Sequence positive targetAngle and positive engine drive rotate clockwise about endpoint A +Z; preview converts both to the Three.js/Rapier right-hand sign. Engine link reverse flips that sign. This engine direction is established by the user's native Jeeep test. Preserve saved reversals when regenerating.
- Use native shared frame columns 0–10 for ordering. Same column means simultaneous; later columns stage actions. Bearing angles accumulate; piston settings are absolute lengths, including zero returns. timePerFrame is seconds per step. Observed playMode 0 is once/return and 2 is Loop, not ping-pong. Do not invent per-row timing fields. Keep saved startAngle/endAngle synchronized with frame changes.
- Pistons are joint interactables with unique controller IDs. Direct input connects to that ID; sequence piston rows use controllers[].frames[].setting. Constructors use one-block collapsed anchor spacing. Respect travel and speed metadata; report unverified survival timing and load response.
- Thruster controller.level is native 0–6; it is distinct from upgrade tier. Configure it deliberately, and preserve engine fuel/opaque state while editing gear. Batch settings must preserve IDs, connections and every untouched field.
- Test every switch/button, gate/interlock and release. Use preview_controller_motion / studio.setInput(), studio.advance(), studio.logicStates(), studio.connectionStates() and studio.simulate(false). Logic modes follow installed native descriptions; feedback, empty inputs and tick timing need native confirmation.
- Run check_motion_collisions / POST /api/check-motion / studio.checkMotion() for functional builds. Review rest contacts, mid-path intersections and incomplete cases; replay reported collisions. Repair clearance, hinges, travel or interlocks in the recipe and repeat. Add targeted input combinations; automated cases are not exhaustive. Finite collision samples, joint rods, hull estimates and kinematic timing do not certify native physics. Save the motion report alongside captures.

Portability: resolve game, profile and workspace through lib/assets.mjs / lib/paths.mjs. Never hardcode a username, Steam account, game install path or personal default blueprint. Capture output is relative to the resolved WORK directory; use the returned capture paths when workRoot is overridden.

Seat steering correction from user native testing: A is negative steering input, D positive; convert targets to the opposite right-hand physics sign before applying each saved bearing reversal. Preserve left/right native angle and speed selection.
