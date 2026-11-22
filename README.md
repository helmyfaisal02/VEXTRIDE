# VEXTRIDE

VEXTRIDE is a stylized, single-player, 3D browser game with six city districts, three drivable vehicles, ambient traffic and pedestrians, two missions and a working garage. Create a character, explore the city, earn fictional Street Cash and spend it on garage resprays. Guest progress is saved in the current browser and origin.

Built with React, TypeScript, Vite, Three.js, React Three Fiber, Rapier and Zustand. The desktop game uses WebGL2, a keyboard and a mouse. The UI adapts to narrow screens.

The city spans 340 × 340 metres across Central Plaza, Downtown, Residential, Motor Row, Warehouse / Industrial and Riverside. Central Plaza is the normal starting point and the old physics demo yard remains east of the city. The character creator includes Urban Blue, Street Red and Metro Green with cosmetic customization. [City map](docs/city-layout.png) · [Arc Studio](https://studio.arc.io)

## Run locally

Use [Bun](https://bun.sh) 1.4.4.

```bash
bun install --frozen-lockfile
bun run dev
bun run check
bun run verify:all
bun run build:pages
```

The Pages build outputs `dist/` and checks its static assets. No app environment variables, server, authentication or wallet are needed to play.

## Controls

- `WASD` moves or drives. `Shift` sprints and `Space` jumps or applies the handbrake.
- `E` interacts, enters a vehicle or exits a vehicle. `R` recovers a vehicle.
- Drag to rotate the camera and scroll to zoom.
- `F` shows performance data, `P` shows colliders, and `C` toggles the debug orbit camera.

## Arc Wallet

The optional wallet supports direct Arc USDC transfers and separate payments through the fixed-recipient VEXTRIDE router. Arc Mainnet chain ID is **5042**. Router address is `0xcAD7E77c93485F7eADe96AC7a58437ded3777FCF`. Router payment transfers real funds and grants no game benefits. Street Cash is a separate fictional economy. A wallet is never connected automatically.

- [SC-4 deployment and verified contract evidence](docs/smart-contract/SC-4-deployment-evidence.md)
- [SC-5 implementation and test report](docs/smart-contract/SC-5-implementation-report.md)
- [Cloudflare Pages Free setup, production checklist, manual payment acceptance and rollback](docs/cloudflare-pages-release.md)
- [Production dependency remediation and audit results](docs/dependency-security-remediation.md)

The router is deployed. Real-payment acceptance is **PENDING** and public application publishing remains owner-controlled.
