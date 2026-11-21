# Phase 4.4 — Motor Row Shakedown & Phase 4 Integration

## 1. Initial inspection

Started with a clean `main` at `197ecdf` (`feat: add VEXTRIDE First Contact mission`), tracking `origin/main`. Local identity: `helmyfaisal02 <hijautua39@gmail.com>`. Read AGENTS.md and inspected mission definitions/state/actions/HUD, normal NPC dialogue and E routing, player/vehicle pose tracking, recovery revisions, cameras, directed lanes/legal turns, Motor Row driveway metadata, ambient systems and existing tests. Baseline verification passed all **963 cases/groups** before edits.

## 2. Files created or modified

Created:
- `src/game/missions/checkpointRoute.ts`: graph-derived gates and route validation.
- `src/game/missions/checkpointCrossing.ts`: deterministic swept crossing predicate.
- `src/game/missions/MissionDriver.tsx`: post-physics occupied-vehicle observer.
- `scripts/verify-shakedown.ts`: focused state, route and real-Rapier tests.
- This report and browser evidence in `docs/phase44/`.

Modified:
- `src/game/missions/missionDefinitions.ts`: exactly two missions, dependency and checkpoint objectives.
- `src/game/missions/missionState.ts`: completed history, availability and guarded checkpoint events.
- `src/game/missions/missionManager.ts`: mission-aware acceptance/decline/acknowledgement.
- `src/game/missions/missionPresentation.ts`: current checkpoint or NPC target.
- `src/game/hud/MissionDialogueActions.tsx`: reuse offer/acknowledgement UI for both missions.
- `src/game/hud/MissionHud.tsx`: mission-specific completion title and occupied-vehicle distance reference.
- `src/game/world/World.tsx`: mount the observer.
- `scripts/verify-missions.ts`: update the obsolete one-definition assertion to two; retain all First Contact checks.
- `scripts/verify-mission-integration.tsx`: retain previous checks and extend combined mounted gameplay coverage.
- `package.json`: include the additional verification script.

No dependencies, lockfile, environment, city geometry, vehicle controller, ambient route or NPC definition changes.

## 3. Mission framework

The existing typed reducer and Zustand store remain the sole mission framework. Current progress preserves the Phase 4.3 API; completed mission IDs retain independent session history. Derived statuses expose LOCKED, AVAILABLE, ACTIVE and COMPLETED. At most one mission is active. Acceptance validates prerequisites, giver and fresh dialogue session. Ordered NPC acknowledgements and checkpoint events cannot substitute for one another. Completed missions cannot restart, and invalid/duplicate events preserve the same state object.

## 4. Motor Row Shakedown progression

After completing First Contact, speak to Marcus and choose **Start Motor Row Shakedown**, then **Accept Motor Row Shakedown**. **Not now** declines without changing progress. Use any existing player car to cross A, B and C in order. Exiting, switching cars or exploring temporarily does not reset completed gates. After C, return to Marcus, exit, talk on foot and explicitly choose **Finish Motor Row Shakedown**. The five-second confirmation names the correct mission. No rewards, ownership, inventory or persistence were added.

## 5. Route and gates

Coordinates use world X/Y/Z in meters; gate height is existing road top, Y = 0.03.

| Gate | Position X, Z | Directed lane | Expected travel | Road class |
| --- | --- | --- | --- | --- |
| A | 135.19, -156.50 | RX03:E | East (+X) | Main |
| B | 156.50, -118.75 | RZ40:S | South (+Z) | Main |
| C | 118.75, -82.25 | RX13:W | West (-X) | Secondary |

The route starts downstream of the existing north-parking curb cut at X = 114 on RX03. It uses existing legal right turns J40 and J41, then leads back toward the garage frontage. Gates are interpolated from lane metadata, inside asphalt rectangles, away from junction edges and the demo yard. Each gate has a unique ID, order, direction and 3.6 m activation width. Actual-city Rapier tests drive all three vehicle types across every gate with the existing chassis and road colliders.

The post-physics observer reads only the occupied player vehicle's actual rigid-body pose and velocity. A swept plane crossing must be forward, heading-aligned, at least 1 m/s, upright and near road height, with credible fixed-step displacement. Wrong lanes/directions, stationary frames, future gates, walking, ambient agents, recovery revisions, large discontinuities, vehicle changes and fresh observer mounts do not create a crossing. Normal recovery physics remains unchanged.

## 6. Marcus dialogue

His original three lines remain intact. Before First Contact completion he does not offer Shakedown. Afterward he offers explicit acceptance/decline. Early visits provide a reminder without advancing checkpoints. Only the final on-foot acknowledgement completes the mission. Both completed missions leave ordinary dialogue available, without duplicate offers.

## 7. First Contact compatibility

Its accepted text, objective order, Maya offer/decline, Marcus visit, Maya return, completion UI and session-only behavior remain. Existing First Contact reducer, real-NPC interaction, input and mounted tests are retained. Starting Shakedown keeps First Contact COMPLETED.

## 8. Vehicle and ambient compatibility

No changes to handling, speed caps, entry/exit, recovery, signals, camera or keyboard input. Mounted integration drives A with the Coupe, B with the Sedan and C with the Pickup, using actual fixed-step motion after fixture setup. Safe exits and car changes preserve progress. Traffic and pedestrians remain separate and cannot act as mission vehicles or NPC targets. Existing E priority and dialogue controls remain the only interaction routing.

## 9. HUD and marker

The existing compact card shows only the current objective and target, including 1/3, 2/3 or 3/3 for gates. It changes to Marcus after C and clears after completion. Guidance is a HUD compass/distance indicator, not a 3D gate, minimap or road-route planner. Distances remain explicitly straight-line and reference the active vehicle when driving. Creator hides the card. Normal vehicle HUD, world clock and NPC hints remain.

## 10. Performance and resources

One lightweight post-Rapier-step callback, active only for checkpoint objectives. No physics writes, new bodies, checkpoint geometry, textures, lights, global keyboard listeners or network requests. React/Zustand notifications occur on progression, not every simulation sample. Existing 250 ms DOM-ref distance updates and five-second completion timeout retain cleanup. Mounted tests verify constant body/collider/listener counts and one observer callback through remounts. Browser counts observed during the mission: **46 bodies / 564 colliders**, with five ambient agents.

## 11. Required validation

- `bun run lint`: PASS.
- `bun run typecheck`: PASS.
- `bun run build`: PASS.
- `bun run verify:all`: PASS, exit 0, **992 cases/groups** (all previous 963 plus 19 additional mounted checks and 10 focused groups).
- `git diff --check`: PASS.

Production app bundle: 173.69 kB minified / 59.94 kB gzip. The existing 2,058.37 kB Rapier chunk still produces Vite's large-chunk warning. No hardware FPS claim is made.

## 12. Browser evidence

**Complete desktop gameplay: 18 checks passed.** Created a character, physically walked/sprinted from Central Plaza, declined and accepted First Contact, visited Marcus, returned to Maya and completed it. Then physically returned to Marcus, declined and accepted Shakedown, checked early-report rejection, walked to the original Coupe, entered with E and drove it through the north-parking access and all three ordered gates, including both junction turns. Exited, walked to Marcus, explicitly completed Shakedown, checked ordinary dialogue/no restart, expiry of completion feedback and both completed history entries. No player/car teleport, forced velocity or mission-state fixture was used for this journey. See [desktop results](phase44/browser-results.json), [all gates cleared](phase44/three-checkpoints-cleared.png) and [second mission complete](phase44/shakedown-complete.png).

The walking harness initially aimed through its own parked car after exiting. It was resumed around the car in the same live browser session. Earlier attempts also exposed Node-only harness mistakes, which were corrected without gameplay edits. The local Vite process exited during the successful journey, causing HMR WebSocket errors and a failed optional diagnostic import. The already-loaded scene continued; both missions completed. This transport limitation is recorded rather than claiming a completely clean browser console. No game JavaScript exception or shader error was observed.

**Mobile: nine checks passed**, using explicit UI/proximity fixtures at 375×812: acceptance focus, offer layout, current-gate-only HUD, Creator hiding/restoration, preserved mission history, session reset on refresh and character persistence. See [mobile results](phase44/mobile-results.json), [offer](phase44/mobile-offer.png) and [HUD](phase44/mobile-checkpoint.png). This is UI coverage, not a touch-driven physical route run.

**Nighttime: six behavioral checks passed**, using separate mission/proximity fixtures: real Coupe E entry, mission/vehicle HUD visibility, developer world-time compatibility, mouse camera orbit/zoom, F/P/C preservation and all three cars/five ambient agents mounted. The blanket-console assertion failed on the existing favicon 404; it was classified separately after resource inspection. See [night results](phase44/night-results.json) and [night HUD](phase44/night-driving-hud.png).

Browser physics counts remained **46 / 564** during and after the combined missions, with five ambient agents. Chromium uses SwiftShader; no hardware FPS or owner manual acceptance is claimed.

## 13. Limitations

- Both missions remain session-only: reload resets them; character persistence is unchanged.
- Guidance is straight-line; players choose roads and follow Marcus's directional instructions. Only the three gates enforce heading/sequence; this is not continuous lane-law enforcement or a GPS system.
- Individual gate traversal uses all three cars in real Rapier tests. Full physical browser journey uses the Coupe.
- The local development server exited during browser automation, causing HMR connection errors; loaded gameplay continued to completion.
- Existing missing `/favicon.ico` returns HTTP 404. This is a missing icon request, distinct from JavaScript/shader errors.
- Existing subtitle still reads NPC Foundation / Phase 4.1; unrelated branding is preserved.

## 14. Owner manual acceptance checklist

- [ ] Create/customize a character; explore Central Plaza and speak normally with Maya.
- [ ] Decline, then complete First Contact with explicit acknowledgements and normal movement restored.
- [ ] Verify Marcus cannot offer Shakedown before First Contact completion.
- [ ] Decline Shakedown; reopen and accept explicitly.
- [ ] Check current objective/target and vehicle HUD while driving.
- [ ] Cross A eastbound, B southbound and C westbound; check immediate HUD updates.
- [ ] Confirm walking, wrong direction, future gates, repeated frames and R recovery cannot skip checkpoints.
- [ ] Exit and switch cars mid-route; confirm completed gates remain.
- [ ] Talk to Marcus early; confirm no completion. After C, exit and explicitly finish with him.
- [ ] Check correct completion title, no stale marker, no restart, ordinary NPC dialogue and free exploration.
- [ ] Check day/night, ambient traffic/pedestrians, cameras, focus loss and F/P/C/Shift+T.
- [ ] Reload: both missions reset; character remains saved.

## 15. Git safety

Final branch/HEAD remain `main` / `197ecdf`; local identity remains `helmyfaisal02 <hijautua39@gmail.com>`. Ten tracked files are modified, with four new code/test files plus this report and evidence. All changes are unstaged; the index is empty. No identity/configuration/authentication changes, staging, commits, pushes, deployments or blockchain actions. Phase 5 is not started.
