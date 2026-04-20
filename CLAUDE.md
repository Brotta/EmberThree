# CLAUDE.md

## Project Overview

EmberThree is an open source alternative to JangaFX's EmberGen, tailored to developers
building web games with Three.js. It consists of two components: a web-based editor that
simulates volumetric VFX (smoke, fire, muzzle flash) through a GPU fluid solver, and a
runtime library for Three.js that consumes the exported files as animated billboards.
The key architectural principle is: simulate heavily once, export to flipbook, pay
almost nothing at playback time in-game.

## Architecture

EmberThree is split into two distinct "worlds" that only communicate through exported
files on disk:

- **Editor** (`src/editor`, `src/sim`, `src/export`): runs in the browser of the VFX
  author. Uses the GPU intensively to run the fluid solver. Output: PNG spritesheet
  plus a JSON metadata file.
- **Runtime** (`src/runtime`, eventually a separate npm package `three-emberthree`):
  a lightweight library that takes the PNG + JSON pair and plays it back as a billboard
  in a Three.js scene. `three` is a peer dependency, and it contains zero simulation
  logic.

The pipeline is:

```
Simulate (GPU-heavy) → Bake (read pixels from render targets) → Export (PNG atlas + JSON)
                                           ↓
                            Load in game → Playback (fragment shader animates UVs in atlas)
```

## Tech Stack

- **TypeScript** + **Vite** as the build tool
- **Three.js** as the rendering engine — used both in the editor (simulation and preview)
  and in the runtime
- **WebGL2** with GLSL shaders for the fluid solver (not WebGPU yet, for ecosystem
  maturity reasons)
- Native **Canvas API** for flipbook packaging, zero external dependencies for export
- No UI framework for now (plain HTML/CSS in the editor), possibly React later

## Project Structure

```
src/
  sim/        # GPU fluid solver (ping-pong buffers, shader passes, Navier-Stokes)
  editor/     # Editor UI, controls, preview
  export/     # Frame baking to flipbook PNG + JSON metadata generation
  runtime/    # Consumer library for Three.js (FlipbookSprite, playback shader)
```

## Core Concepts

### Ping-pong framebuffer
WebGL cannot read and write the same texture in a single pass. The solver therefore
keeps two `WebGLRenderTarget` instances and swaps (ping-pongs) between them every step:
read from A, write to B, then swap roles.

### Stable Fluids (Jos Stam, 1999)
The solver follows the classic sequence of passes:

1. Advect velocity
2. Apply external forces
3. Compute divergence
4. Solve pressure with Jacobi iterations
5. Project velocity to be divergence-free
6. Advect density

### Flipbook / sprite atlas
A single texture holding every animation frame in a regular grid (e.g. `8×8 = 64`
frames). At runtime, the fragment shader computes the UV offset of the current cell
based on elapsed time.

### WebGL vs Canvas coordinate flip
WebGL places the origin in the bottom-left, Canvas 2D in the top-left. A vertical flip
is required during export when copying pixels from a render target into a 2D canvas.

### 6-way lighting (future feature, not yet implemented)
Technique that makes smoke react to scene lights by baking 6 directional lightmaps
(one per principal axis) and blending them at runtime based on incoming light direction.

## Roadmap & Current Phase

- [ ] Phase 1: Minimal runtime library (`FlipbookSprite` that reads a static test PNG)
- [ ] Phase 2: Muzzle flash generator (procedural, no fluid solver)
- [ ] Phase 3: Smoke with a 2D fluid solver (basic flipbook, unlit)
- [ ] Phase 3.5: 6-way lightmap export for reactive lighting
- [ ] Phase 3.6: Soft particles (depth flipbook + blend against scene depth buffer)
- [ ] Phase 4: Fire (solver extended with a temperature field + color ramp)
- [ ] Phase 5: Advanced extensions (3D sim, VDB export, etc.)

**Currently working on: Phase 1**

## Development Commands

```bash
npm install       # install dependencies
npm run dev       # start Vite in dev mode (hot reload)
npm run build     # production build
npm run preview   # preview the build
```

## Coding Conventions

- TypeScript `strict` mode, avoid `any` whenever possible
- GLSL code lives in separate `.glsl` files (imported as strings via Vite plugin or
  template literals), not inlined in TS when it exceeds ~10 lines
- Class names in `PascalCase`, functions in `camelCase`, constants in
  `SCREAMING_SNAKE_CASE`
- One file = one clear responsibility; if a file grows past ~300 lines it probably
  needs to be split
- Code comments in English; discussions and prompts can be in Italian
- Commit messages in English, following Conventional Commits (`feat:`, `fix:`,
  `refactor:`)

## Important Notes for Claude Code

- This project is built by a hobbyist, not a professional programmer. When introducing
  complex concepts (shaders, fluid math, WebGL internals), explain them step by step
  before writing code.
- Do not invent shader code from scratch for the fluid solver: use
  `PavelDoGreat/WebGL-Fluid-Simulation` (MIT) as the canonical reference, adapting it
  to Three.js + TypeScript.
- Prefer small, visually verifiable increments over large refactors: 7 working steps
  beat one perfect-but-incomplete attempt.
- Before writing new code, always propose a 3–5 point plan and ask for confirmation.
- If the user's prompt is ambiguous, ask for clarification instead of guessing.

## References

- Jos Stam, *Real-Time Fluid Dynamics for Games* (2003 paper)
- [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation)
  (reference GitHub repo)
- Three.js docs: [`WebGLRenderTarget`](https://threejs.org/docs/#api/en/renderers/WebGLRenderTarget),
  [`ShaderMaterial`](https://threejs.org/docs/#api/en/materials/ShaderMaterial),
  [`FullScreenQuad`](https://threejs.org/docs/#examples/en/postprocessing/EffectComposer)
- [Unity blog post on 6-way lighting](https://blog.unity.com/engine-platform/how-to-simulate-6-way-lighting-in-shader-graph-for-volumetric-lighting)
  (for Phase 3.5)
- [EmberGen by JangaFX](https://jangafx.com/software/embergen) (the conceptual reference
  product)
