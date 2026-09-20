# Rage Room

Rage Room is a responsive browser game where players smash breakable room objects, build combos, and fill a rage meter with tactile visual and audio feedback.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/rage-room/src/App.tsx` — game state, object definitions, effects, audio synthesis, and interaction logic
- `artifacts/rage-room/src/index.css` — the visual system, responsive layout, object art, and animation effects
- `attached_assets/rage_room_(2)_1789923571253.html` — original standalone prototype reference

## Architecture decisions

- The first build is frontend-only; game state is intentionally local because the experience is a self-contained session.
- Breakable objects are CSS-drawn so the game stays fast, dependency-light, and visually consistent at different viewport sizes.
- Audio is synthesized in the browser and starts only after user interaction to respect browser autoplay policies.

## Product

- Choose between hammer, bat, and axe tools with different damage and scoring multipliers.
- Hit objects repeatedly until they break, with HP, cracks, debris, impact rings, score pops, screen shake, and combo banners.
- Maintain combo momentum, fill the rage meter, add more targets, mute audio, reset the room, and play with touch or keyboard controls.

## User preferences

No additional preferences recorded.

## Gotchas

- Browser audio is muted until the first user gesture when autoplay restrictions apply.
- The artifact workflow supplies `PORT` and `BASE_PATH`; use the managed workflow for preview and builds.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
