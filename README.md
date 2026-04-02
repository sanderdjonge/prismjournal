# PrismJournal

> **Self-hosted trading journal** — Track, analyze, and improve your trading performance.

PrismJournal is a full-featured trading journal you can run on your own server. It connects to MetaTrader 5 via an EA that syncs trades automatically, supports multiple accounts and prop firm challenges, and provides analytics including equity curves, Prism Score, tilt detection, and a what-if scenario simulator.

## Features

- **MT5 Auto-Sync** — PrismSync EA pushes trades from MetaTrader 5 in real-time
- **Multi-Account** — Manage multiple trading accounts (live, paper, prop firm) under one login
- **Prop Firm Tracking** — Challenge phases, daily drawdown, trailing drawdown, rule violations
- **Prism Score** — Composite performance score across R-multiple, win rate, plan compliance, and psychology
- **Tilt Detection** — Detects emotional trading patterns from recent behavior
- **Strategy Compliance** — Define rules, validate every trade against them automatically
- **What-If Simulator** — Replay your trades with different filters and see the outcome
- **Psychology Tracking** — Mood, emotional state, plan compliance, entry/exit/management ratings per trade
- **Equity Curve** — Full equity curve with daily snapshots and benchmark comparison
- **Screenshot Capture** — Automatic chart screenshots on trade sync via Twelve Data API
- **Daily Digest** — Email and/or Telegram summary of your trading day
- **2FA** — TOTP-based two-factor authentication
- **Admin Panel** — User management, system health, audit log

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **PostgreSQL** + Prisma ORM
- **NextAuth.js v5** (credentials + TOTP 2FA)
- **Tailwind CSS 4** — glassmorphic dark theme
- **TanStack React Query** — client-side data fetching
- **Recharts** — charts and analytics visualizations
- **Docker** — multi-stage build, runs as a single container

## Self-Hosting with Docker

### 1. Prerequisites

- Docker + Docker Compose
- A domain with SSL (recommended) or a local network setup
- PostgreSQL (included in compose, or bring your own)

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. Required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Session key — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of your instance (e.g. `https://journal.example.com`) |

See `.env.example` for all optional variables (Telegram, email, Twelve Data, etc.).

### 3. Start

```bash
docker compose -f docker-compose.prod.yml up -d
```

The app starts on port **3002** (configurable via `APP_PORT` in `.env`). Migrations run automatically on startup.

### 4. First user

Register through the UI at `/login`. The first user is a regular user — promote them to admin:

```bash
docker exec prod_app npx tsx scripts/make-admin.ts your@email.com
```

### 5. Seed prop firm reference data (optional)

```bash
docker exec prod_app npx tsx prisma/seed-prop-firms.ts
```

This populates the prop firm selector with common firms (FTMO, MyForexFunds, etc.).

## MT5 Integration

1. Copy `server/workers/PrismSync.mq5` to your MT5 `Experts` folder
2. Set `SyncUrl` to `https://your-domain.com/api/sync`
3. Get your Bridge Key from **Settings → Connector Hub** in the app
4. Enter the Bridge Key ID and Bridge Key in the EA inputs
5. Attach the EA to any chart — trades sync automatically on open, close, and update

The EA supports MetaTrader 5. Rate limit: 600 requests/minute (handles EA bursts).

## Optional Features

### Telegram notifications

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token
2. Set `TELEGRAM_BOT_TOKEN` in `.env`
3. Set the webhook: `POST /api/telegram/set-webhook` (or let the app set it on startup)
4. In the app: **Settings → Notifications → Telegram** — connect your chat ID

### Email notifications

Uses [Resend](https://resend.com). Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`.

### Chart screenshots

Uses [Twelve Data](https://twelvedata.com) for historical OHLC data and renders charts headlessly via Playwright. Set `TWELVE_DATA_API_KEY` in `.env`.

## Local Development

```bash
npm install
cp .env.example .env        # configure DATABASE_URL at minimum
npx prisma migrate dev
npm run dev                 # http://localhost:3000
```

Or with Docker (app on :3002, Postgres on :5433):

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Commands

```bash
npm run test        # Vitest unit tests
npm run e2e         # Playwright end-to-end tests
npm run lint        # ESLint
npm run build       # Production build
```

## Upgrading

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Migrations run automatically on startup via `docker-entrypoint.sh`.

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

[GNU Affero General Public License v3.0](LICENSE) — if you modify and run this software as a service, you must make the modified source available.
