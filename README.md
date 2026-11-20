# VEXTRIDE

A browser-based, stylized 3D open-world urban adventure game. Current state: a physics-driven 3D test world with a playable third-person character (run, sprint, jump), a follow camera, and a character creator with three presets. Vehicles, the city, missions and Arc integration come in later phases.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- React, TypeScript, Vite
- Three.js with React Three Fiber and drei
- Rapier physics (`@react-three/rapier`)
- Zustand for game state
- Tailwind CSS

## Controls

- `WASD` move, `Shift` sprint, `Space` jump
- Mouse drag rotates the camera, scroll zooms
- `P` toggles collider debug view
- `F` toggles a measured performance readout
- `C` switches to a free debug orbit camera and back

## VEXTRIDE City (road network)

A 340 x 340 m city centred on the world origin (X east, Z south, 1 unit = 1 m): a 5 x 5 grid of junctions joined by 40 road segments, with sidewalks, curbs, crosswalks, stop lines and lane markings. Main roads are 14 m wide (an outer loop plus a central crossing) and secondary roads 9 m; sidewalks are 2.5 m with 0.13 m curbs. Six districts are laid out as zones: Central Plaza (start), Downtown, Residential, Motor Row, Warehouse / Industrial and Riverside. You start on the plaza. The earlier demo objects and the step test area now sit in a demo yard east of the city (about 260 m along +X). `docs/city-layout.png` is a top-down map of the layout (`bun run city:map` regenerates it).

## City buildings and environment

The roads are now lined with 20 procedural buildings across nine types (offices, brick shops, apartments, houses, convenience stores, an auto garage, a vehicle showroom, warehouses and workshops), each with windows, doors, awnings or loading docks, and a sign. Each district has its own look: Downtown (offices, brick storefronts, benches and planters), Residential (houses with fenced yards and driveways, low-rise apartments), Motor Row (garage, showroom, parking lots), Warehouse / Industrial (warehouses with loading docks, container yards), Riverside (park lawns, promenade, pavilion and an empty strip reserved for a future river) and Central Plaza (paved square with a landmark monument, benches, planters and trees). Streets have lamps, trees, benches, bins, hydrants and stop signs. Everything is placed from fixed data, so the city is identical on every load.

## Movement notes

The character climbs ledges up to 0.2 m (curbs, stairs) when walking or sprinting; anything taller blocks. A small test area with blocks of rising height and a short staircase sits at the far corner of the map (look toward +X, -Z from the start). Camera changes (creator, follow, debug orbit) blend smoothly rather than snapping.

## Character creator

On first launch you choose a name, one of three presets (Urban Blue, Street Red, Metro Green) and a clothing colour, previewed live on the real in-game character. Your choice is saved in this browser (guest only, no account) and restored on refresh. Use the character button at the top right to reopen it. Customisation is cosmetic only.

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run dev         # start the dev server on port 5173
bun run check       # lint + typecheck
bun run verify:all        # headless checks: controller physics, settings, models, input, cameras, player, city layout / geometry / physics
bun run city:map          # render docs/city-layout.png (roads, buildings and props) from the layout data
bunx vite build     # production build
```

### Environment variables

None.
