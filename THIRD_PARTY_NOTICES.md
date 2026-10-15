# Third-party notices

Blueprint Studio source is MIT licensed. Installed dependencies retain their licenses and copyright notices. `package-lock.json` records exact dependency versions; npm installs the relevant license files.

| Direct dependency | License | Project |
|---|---|---|
| Three.js | MIT | https://github.com/mrdoob/three.js |
| Rapier 3D compatibility package | Apache-2.0 | https://github.com/dimforge/rapier.js |
| Model Context Protocol TypeScript SDK | MIT | https://github.com/modelcontextprotocol/typescript-sdk |
| jsonc-parser | MIT | https://github.com/microsoft/node-jsonc-parser |
| Zod | MIT | https://github.com/colinhacks/zod |
| Playwright | Apache-2.0 | https://github.com/microsoft/playwright |

Transitive dependencies have their own notices; preserve them when redistributing installed dependencies or a bundled build. This source release does not bundle node_modules or browser binaries.

Scrap Mechanic, its scripts, meshes, textures, icons and other game content are owned by Axolot Games and other respective rights holders. They are read from the user's installed game and are not relicensed by this project's MIT license. The user-supplied preview screenshot contains rendered game content for illustration.

Implementation references include the installed shape/render/rotation/Lua definitions, OGRE mesh format documentation (https://github.com/OGRECave/ogre), and blueprint joint-coordinate behavior described in Advanced Blueprint Tool V2 (https://github.com/brentbatch/Advanced-Blueprint-Tool-V2). These references are not bundled game assets or a claim of native-engine equivalence.
