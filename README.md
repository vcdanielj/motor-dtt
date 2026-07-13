# Motor DTT · Estandarización

A browser-based PWA for standardizing DTT distributor data. It runs entirely
client-side — CSV/XLSX files are parsed and counted in a Web Worker, nothing
is ever uploaded to a server (see RNF5 / privacy invariant below). Views:
Dashboard, Corrida, Distribuidores, Cola de revisión, Maestro de clientes,
Configuración.

Stack: React + TypeScript + Vite + Zustand + Tailwind, installable as a PWA
(offline app shell, no runtime caching of data files).

## Local development

```bash
npm install
npm run dev       # start dev server
npm run lint       # eslint src/**/*.{ts,tsx}
npm run test       # vitest run
npm run build       # tsc -b && vite build -> dist/
npm run preview     # preview the production build locally
```

Node 22 is expected (pinned in `.nvmrc` and in CI).

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request: `npm ci` → `npm run lint` → `npm run test` → `npm run build`, then
uploads `dist/` as a build artifact. There are no secrets or environment
variables required — the app is fully static.

## Deploy runbook

### 1. One-time GitHub setup

```bash
# from the repo root, on branch sprint-1-foundations
git remote add origin git@github.com:<your-org-or-user>/dtt-motor.git
git push -u origin sprint-1-foundations
```

Open a PR from `sprint-1-foundations` into `main` (or merge/push directly to
`main` if you prefer) so the `ci` workflow runs. Once merged, `main` is the
branch Cloudflare Pages will build from.

### 2. Cloudflare Pages

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to
Git**, select this repository, then configure:

| Setting | Value |
| --- | --- |
| Framework preset | `None` (or `Vite`, equivalent) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (set `NODE_VERSION=22` as an environment variable, or rely on `.nvmrc` at the repo root) |
| Environment variables / secrets | None — the app is fully static and does no server calls |

`public/_headers` ships in the build output and is picked up automatically
by Cloudflare Pages — no extra configuration needed. It sets
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a
`Content-Security-Policy` whose `connect-src 'self'` enforces RNF5 at the
browser level (no data can be exfiltrated to any external host), while
`worker-src 'self' blob:` allows the ingest Web Worker to run.

After the first deploy, every push to `main` triggers a new Pages build
automatically (independent of the GitHub Actions CI, which only lints/tests/
builds for verification and artifact upload).
