# VEXTRIDE Phase 4.1 — NPC Foundation

Implemented exactly two interactive NPCs. Automated/local browser validation is complete; owner manual acceptance remains pending. No Phase 4.2 work.

## 1. Initial inspection

Started from clean `main...origin/main`, HEAD `64a6f13` (`fix: stabilize VEXTRIDE vehicle system`). Phase 3.4 was committed. Local identity was verified as `helmyfaisal02` / `hijautua39@gmail.com` and remains unchanged.

Inspected character models/rigs/animation/controller, world and lighting, city surfaces, garage/building and environment placement/collision data, Central Plaza, four driveways, Rapier setup, input hook, vehicle E coordinator and all vehicle systems, Zustand state, creator, HUD, CameraDirector and existing tests. Baseline `bun run verify:all` passed all 831 prior PASS cases/groups.

## 2. File inventory

Modified:

- `src/game/vehicles/VehicleSystem.tsx`: route its existing single E coordinator callback through shared target selection.
- `src/game/input/useKeyboardInput.ts`: dialogue input guard/Escape through the existing listener.
- `src/game/character/useCharacterController.ts`: conversation-only horizontal movement lock and controller reset after closing.
- `src/game/world/World.tsx`: mount NPCSystem.
- `src/game/hud/Hud.tsx`: mount dialogue/hints, update E label and Phase 4.1 subtitle.
- `package.json`: add `verify:npcs` and `verify:npc-integration` to `verify:all`.

Created:

- `src/game/npcs/npcConfig.ts`: two definitions, deterministic placements, appearance/role/dialogue data.
- `src/game/npcs/npcGeometry.ts`: shared procedural humanoid builder and idle pose sampling.
- `src/game/npcs/npcState.ts`: mounted body registry.
- `src/game/npcs/NPCSystem.tsx`: shared renderer, fixed capsules, animation and lifecycle cleanup.
- `src/game/interactions/interactionCoordinator.ts`: nearest eligible NPC/vehicle arbitration.
- `src/game/interactions/dialogueState.ts`: discrete conversation state/actions.
- `src/game/hud/NPCDialogue.tsx`: accessible dialogue/hint panel.
- `scripts/verify-npcs.ts`: definition, geometry, physics, placement and arbitration tests.
- `scripts/verify-npc-integration.tsx`: mounted controller/input/camera/vehicle/cleanup tests.
- This report and `docs/phase41/`: browser results and seven screenshots, including mobile.

No dependency/lockfile, player preset/model, persistence, vehicle model/handling/recovery, CameraDirector, lighting, road graph, building, prop or driveway changes. Existing test scripts were preserved.

## 3. Marcus — Mechanic

Position **(91, 0.03, -91)**, facing south. The position derives from the existing garage footprint: two meters in from its west edge, three meters south of its front. It is beside the garage facade, west of the garage-bay driveway approach and clear of its entrance, road, sidewalk corridor and parked coupe. Full actual-environment clearance and supported-ground checks pass.

Original appearance: slate work jacket, ochre work bib/straps and pockets, pocket tool, dark work trousers, brown boots, navy cap/brim and restrained beard. Approximately 1.9 m tall; 300 triangles in five merged animated parts. Distinct from all player presets.

Dialogue:

1. “I'm Marcus. You'll usually find me here by the garage.”
2. “The coupe is quick, the sedan is steady, and the pickup takes a little more room to turn.”
3. “Take them for a spin. Leave the driveway clear when you park.”

No paid services, customization, purchasing or rewards are offered.

## 4. Maya — Dispatcher

Position **(-49.25, 0.16, -41.25)**, facing east. This is on existing raised Central Plaza pavement, eight meters west of the unchanged player spawn. The broad public plaza retains pedestrian access; the position is clear of nearby props, buildings, roads and driveways.

Original appearance: plum urban jacket, gold badge/headset, clipped radio, dark streetwear trousers, practical gray shoes and dark bob hairstyle. Approximately 1.805 m tall; 276 triangles in five merged parts. Different palette, accessories and silhouette from Marcus and the player presets.

Dialogue:

1. “Hey, I'm Maya, the dispatcher. Welcome to Central Plaza.”
2. “This is a good place to get your bearings. Motor Row is northeast of here.”
3. “If you're looking for a drive, there are three parked vehicles around the city. Take your time exploring.”

No missions or rewards are activated or promised.

## 5. Shared architecture

Definitions separate ID/name/role, appearance, transform, dimensions/range and dialogue from rendering. One shared component renders both humanoids. The mounted registry keeps real Rapier bodies separate from configuration and clears targets on unmount. The dialogue store publishes only discrete open/line/hint/close changes.

The model builder reuses the existing procedural GeometryBuilder and box helper, without altering player models or presets. Future definitions/dialogue can use the same coordinator, model component and UI; no mission system or branching dialogue engine was introduced.

## 6. Idle animation

Elapsed-time sine poses produce restrained breathing, arm sway and head turns, with different phases for the two NPCs. Feet stay fixed; only torso scale and joint rotations change. Motion is time-based, with bounded poses tested over a simulated hour at multiple sampling rates. Geometry/materials are created once per mount and never reconstructed by animation. No roaming, schedules or dynamic NPC simulation.

## 7. Interaction and dialogue

On foot, eligible targets require a valid mounted body, horizontal range up to 2.8 m, reasonable elevation and unobstructed line of sight. Actual Rapier rays include solid environment objects and other vehicles, excluding only sensors, the player and the selected NPC. Hints show the NPC's name and role.

E opens the first line; Continue advances one line, and the final Close button closes. An explicit close button and Escape work at any line. The panel has a labelled dialog role, live dialogue text, accessible buttons, initial focus and a Tab/Shift+Tab focus loop. It fits a 375 × 812 viewport.

Opening clears held input and horizontal velocity. During conversation, the existing pedestrian controller holds horizontal motion at zero while gravity/collision remain active. Closing resets held keys and controller motion history, so ignored/repeated keys cannot resume movement without a fresh press. Creator opening closes dialogue and retains its existing keyboard/camera priority. Dialogue does not replace the camera or modify character settings/persistence.

## 8. Vehicle E compatibility

The existing VehicleSystem callback remains the single E decision point. Driving routes directly to the original vehicle handler before considering NPCs. While walking, shared selection compares the nearest eligible vehicle and NPC. Exact cross-type ties favor vehicles; equal-distance NPC ties use stable IDs, independent of registry insertion order.

The original vehicle entry/exit implementation, range/occlusion, speed gate, capsule clearance, disabled pedestrian body, input reset and blocked-exit behavior remain unchanged. The coordinator consumes an NPC E press itself and never forwards that press to vehicle entry. Open dialogue suppresses gameplay E, and the store also refuses opening while driving or in the creator. All three vehicle regressions remain passing.

## 9. Physics and spawn safety

Exactly two additional **fixed** bodies, each with one upright capsule matched to its humanoid height/radius. No new dynamic NPC bodies. Tests use the full existing city/environment Rapier fixture to confirm support height, whole-capsule clearance and positions outside roads, driveway crossings/approaches and vehicle spawns. Dynamic player capsules physically stop against both NPCs instead of walking through them.

NPCs are solid if deliberately contacted away from the roads. No ragdoll, damage or vehicle avoidance behavior was added. No city geometry was moved to accommodate them.

## 10. Performance and cleanup

Ten lightweight meshes/geometry buffers total, **576 triangles**, and one shared vertex-colored material. No textures, skinning, added lights, per-frame React updates or per-frame geometry rebuilding. Two cheap registry callbacks register each body once; only near, on-foot targets require NPC line-of-sight queries.

Four mounted NPC removal/remount cycles verify exact disposal of ten geometries and one material, empty target registry/closed dialogue, and stable body/collider/callback/window-listener counts after remount. Final unmount leaves no NPC references, dialogue or listeners. No parallel global E/Escape listener was added.

The actual browser scene retained **41 bodies / 559 colliders** throughout conversations, consistent with adding two fixed bodies/colliders to Phase 3.4. One final, view-dependent sample reported 90 GPU geometries, two textures, 100 draw calls and 25,570 triangles. This is not a matched-view performance benchmark. No hardware FPS or complete heap/VRAM stability claim.

## 11. Required validation

| Command | Result |
|---|---|
| `bun run lint` | PASS, no remaining diagnostics; automatic-fix scope reviewed |
| `bun run typecheck` | PASS |
| `bun run build` | PASS |
| `bun run verify:all` | PASS — 877 PASS cases/groups |
| `git diff --check` | PASS |

The original 831 PASS cases/groups remain passing. Added 16 NPC groups and 30 mounted integration checks; groups may contain several assertions/scenarios. Coverage includes definitions/IDs, full-environment grounded clearance, physical capsule collision, humanoid bounds/geometry, idle stability, range/elevation/wall occlusion, deterministic NPC/car selection, one-action E arbitration, dialogue progression, repeat protection, input/movement reset, driving/creator guards, vehicle re-entry/exit, camera continuity and exact resource cleanup/remount plateau.

Existing build warning remains: the Rapier chunk is 2058.37 kB minified, over the configured 1600 kB warning limit. App chunk: 153.58 kB minified / 53.47 kB gzip. No unrelated dependency or bundling changes.

## 12. Chromium/WebGL checks

**31 retained assertions** passed: 28 desktop checks plus three mobile UI checks. See `phase41/browser-results.json` and screenshots. No JavaScript or shader errors in the completed desktop run; mobile UI check also reported no runtime errors.

Desktop checks include both rendered NPCs, real W approaches from outside interaction range, named hints, E opening, initial accessible focus, character-specific text, movement/jump/E-repeat suppression, stable pedestrian camera, Escape reset, walking restoration, Continue/final Close, explicit close button, daytime/nighttime models/dialogue, subsequent coupe entry, driving beside Marcus without dialogue, E routing only to vehicle exit, F/P/C/Shift+T and stable world counts.

Fixtures placed the pedestrian beyond interaction range near each real spawn, then used real walking/key/button input. Camera-rig fixtures supplied frontal views through the existing follow camera; dialogue itself does not move the camera. A test-only occupied-car position beside Marcus checks driving priority. Vehicles were not teleported for selection. Mobile checks opened Maya through the guarded store solely to inspect panel sizing, keyboard focus wrapping and close behavior.

## 13. Known limitations

Manual owner acceptance remains outstanding. Browser validation used SwiftShader; actual GPU FPS and extended heap/VRAM profiling were not measured. Controlled approach fixtures are not a complete walk from plaza to garage. NPCs are stationary, use simple procedural idle poses, and have no missions, branching, voice, persistence or schedules. The follow camera stays user-controlled, so NPC visibility still depends on where the player aims it. No separate dialogue camera or new nighttime lights.

## 14. Manual acceptance checklist

- Find Maya naturally near plaza spawn and Marcus by the Motor Row garage; inspect clothing, feet, silhouettes and idle movement by day and night.
- Approach from multiple sides, check names/roles/range, and verify walls/parked vehicles block interaction.
- Open each conversation with E; read all three lines, Continue, final Close, explicit close and Escape.
- Hold movement/jump/E while talking and close with keys held; confirm no motion leaks, repeated actions or stuck inputs.
- Check panel sizing/readability and keyboard focus on desktop/mobile; orbit/zoom without a dialogue camera jump.
- Open Character Creator, edit presets/clothing, close and resume talking/walking; verify persistence remains intact.
- Park near an NPC, check deterministic nearest-target selection, enter/exit all three vehicles and confirm driving never opens dialogue.
- Recheck vehicle handling, recovery, lamps/HUD/chase camera, safe exits and parked transforms.
- Recheck F/P/C, Shift+T, world clock, sky, streetlights/windows, road/driveway traversal and physics yard.
- Review hardware FPS and longer play sessions on the target desktop.

## 15. Final Git state and boundary

HEAD remains `64a6f13` on `main`; local identity unchanged. Six tracked files modified, with the new NPC/interaction/UI/test/report/browser files untracked. Nothing staged. No Git configuration/authentication changes, token/private-key access, commits, pushes, deployments or blockchain operations. Work stops after Phase 4.1. Phase 4.2 requires explicit approval.
