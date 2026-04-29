# PrismJournal

> **Self-hosted trading journal** — Track, analyze, and improve your trading performance.

PrismJournal is a full-featured trading journal you can run on your own server. It connects to MetaTrader 5 via an EA that syncs trades automatically, supports multiple accounts and prop firm challenges, and provides deep analytics including equity curves, psychology tracking, tilt detection, a what-if simulator, and much more.

## Features

### Sync & Accounts
- **MT5 Auto-Sync** — PrismSync EA pushes trades from MetaTrader 5 in real-time (open, update, close)
- **Multi-Account** — Manage multiple accounts (live, paper, prop firm) under one login with account switcher
- **Manual Trade Entry** — Log trades manually without an EA
- **Prop Firm Tracking** — Challenge phases, daily drawdown limits, trailing drawdown, rule violations with severity levels, auto-advance between phases

### Analytics
- **Prism Score** — Composite 0–100 performance gauge across R-multiple, win rate, plan compliance, and psychology; 12-week trend
- **Tilt Detection** — Detects emotional trading patterns (revenge trading, FOMO, overtrading) from recent behavior; discipline score 0–100
- **Equity Curve** — Full equity curve with daily snapshots, period filtering (7d/30d/90d/1y), all-time view, tiltmeter overlay
- **Benchmark Comparison** — Overlay SPY/QQQ on your equity curve to compare against market
- **Trading Heatmap** — Day × hour grid showing best and worst time slots by P&L and win rate
- **Trading Hours Breakdown** — Per-hour stats: trade count, win rate, profit, R:R
- **R-Multiple Distribution** — Histogram of your R-multiple outcomes
- **MFE/MAE Excursion Analysis** — Exit efficiency bar and quadrant scatter plot; breakeven detection
- **Per-Symbol Analytics** — Win rate, avg P&L, and volume broken down by instrument
- **Period Comparison** — This week vs last week, this month vs last month
- **Daily P&L Calendar** — Month and year calendar view with per-day P&L and metric dropdown
- **Economic Calendar Overlay** — FOMC, NFP, CPI, GDP event badges on dashboard (USD/EUR/GBP/JPY)
- **Strategy Deep Dive** — Per-strategy equity curve, rule compliance rate, monthly returns, dimension analytics

### Journal & Review
- **3-Panel Review Mode** — Trade list / screenshot viewer / inline detail editor side-by-side
- **Filter Chips** — URL-persisted filter chips across Journal, Analytics, and Performance pages
- **Psychology Tracking** — Mood, emotional state, plan compliance, entry/exit/management ratings per trade
- **Strategy Compliance** — Define rules, validate every trade automatically, track violations with P&L impact
- **What-If Simulator** — Replay trades with different filters and see the outcome; up to 3 side-by-side scenarios including stop optimization, position sizing, trailing stops, partial exits, psychological patterns, and market session filtering
- **Pre-Trade Notes** — Log your plan before entering a trade; reusable setup checklists with per-trade completion tracking
- **Personal Challenges** — Define custom rule-based challenges with pass/fail tracking
- **Missed Trade Logging** — Log trades you saw but didn't take with would-be P&L
- **Auto Chart Screenshots** — Automatic chart captures on trade sync via Twelve Data API + headless renderer
- **Keyboard Shortcuts** — Journal navigation without leaving the keyboard

### Sharing & Public Profile
- **Share Cards** — Generate 600×350px PNG share cards with Discord webhook integration
- **Embeddable Widget** — 300×200px performance widget for embedding on external sites
- **Public Profile** — Shareable public profile page per user

### Notifications
- **Daily Digest** — Email and/or Telegram summary of your trading day; configurable send time
- **Telegram Bot** — Trade open/close alerts, `/pnl` command (today/week/month/year), daily/weekly summaries
- **MDD Alerts** — Email notification when max drawdown threshold is breached
- **Prop Firm Alerts** — Daily loss limit approaching warning at 80%
- **In-App Toasts** — Optional real-time trade execution toast notifications

### User Experience
- **Dark/Light Theme** — Toggle with localStorage persistence; semantic profit/loss colors
- **Mobile-Responsive** — Full layout works on tablet and mobile
- **Invite-Only Registration** — Admin toggle + time-limited invite token generation
- **Onboarding Flow** — Guided setup for new users

### Admin & Security
- **Admin Portal** — User management, audit log, broadcast notifications, system health, backup management
- **2FA** — TOTP-based two-factor authentication with replay protection
- **Redis-Backed Rate Limiting** — Per-endpoint limiters with in-memory fallback
- **User Settings** — Currency, timezone, date format, default dashboard period

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript 6
- **PostgreSQL** + Prisma ORM
- **NextAuth.js v5** (credentials + TOTP 2FA)
- **Tailwind CSS 4** — glassmorphic dark theme with semantic design tokens
- **TanStack React Query** — client-side data fetching and caching
- **Recharts** — charts and analytics visualizations
- **Docker** — multi-stage build, runs as a single container with optional backup and cron sidecars

## Self-Hosting with Docker

### 1. Prerequisites

- Docker + Docker Compose
- A domain with SSL (recommended) — the compose file includes a Cloudflare Tunnel service
- PostgreSQL (included in compose)

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Session key — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of your instance (e.g. `https://journal.example.com`) |
| `POSTGRES_USER` | Postgres username |
| `POSTGRES_PASSWORD` | Postgres password |
| `POSTGRES_DB` | Database name |

See `.env.example` for all optional variables (Telegram, email, Twelve Data, Redis, Cloudflare Tunnel, etc.).

### 3. Start

```bash
docker compose -f docker-compose.prod.yml up -d
```

The app starts on port **3000** inside the container (exposed via Cloudflare Tunnel or reverse proxy of your choice). Migrations run automatically on startup.

### 4. First user

Register through the UI at `/login`. The first registered user is a regular user — promote them to admin:

```bash
docker exec prod_app npx tsx scripts/make-admin.ts your@email.com
```

### 5. Seed prop firm reference data (optional)

```bash
docker exec prod_app npx tsx prisma/seed-prop-firms.ts
```

Populates the prop firm selector with common firms (FTMO, The Funded Trader, etc.).

## MT5 Integration

### PrismSync EA (auto-sync)

1. Copy `server/workers/PrismSync.mq5` to your MT5 `Experts` folder
2. Set `SyncUrl` to `https://your-domain.com/api/sync`
3. Get your Bridge Key from **Settings → Connector Hub** in the app
4. Enter the Bridge Key ID and Bridge Key in the EA inputs
5. Attach to any chart — trades sync automatically on open, close, and update

### PrismTrade EA (visual trading, beta)

`server/workers/PrismTrade.mq5` is a beta EA with a floating toolbar for visual trade planning and execution directly from the MT5 chart. It includes the same auto-sync as PrismSync.

The EA supports MetaTrader 5. Rate limit: 600 requests/minute (handles EA bursts).

## Optional Features

### Telegram notifications

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token
2. Set `TELEGRAM_BOT_TOKEN` in `.env`
3. In the app: **Settings → Notifications → Telegram** — connect your chat ID

### Email notifications

Uses [Resend](https://resend.com). Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env`.

### Chart screenshots

Uses [Twelve Data](https://twelvedata.com) for historical OHLC data and renders charts headlessly via Playwright. Set `TWELVE_DATA_API_KEY` in `.env`.

### Redis rate limiting

Set `REDIS_URL` in `.env` (e.g. `redis://localhost:6379`). Falls back to in-memory if not set. Required for multi-instance deployments.

### Cloudflare Tunnel

Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`. The `tunnel` service in `docker-compose.prod.yml` handles ingress — no host port mapping needed.

## Local Development

```bash
npm install
cp .env.example .env   # set DATABASE_URL to a local postgres instance at minimum
npx prisma migrate dev
npm run dev            # http://localhost:3000
```

To seed sample trade data:

```bash
npx tsx prisma/seed.ts
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
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run automatically on startup via `docker-entrypoint.sh`.

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes.

## License

[GNU Affero General Public License v3.0](LICENSE) — if you modify and run this software as a service, you must make the modified source available.
