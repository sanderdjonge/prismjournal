# PrismJournal

> **Professional Trading Journal** — Track, analyze, and improve your trading performance.

## Features

- **MT5 Auto-Sync** — PrismSync EA automatically syncs trades from MetaTrader 5
- **Advanced Analytics** — Comprehensive performance metrics, equity curves, and strategy analysis
- **Prop Firm Support** — Track challenge progress, phases, and rule violations
- **Prism Score** — Composite trading performance score
- **Tilt Detection** — Identifies emotional trading patterns
- **Strategy Compliance** — Validates trades against your defined rules
- **What-If Simulator** — Scenario analysis on your trade data
- **Psychology Tracking** — Mood, plan compliance, and self-ratings per trade
- **2FA Authentication** — TOTP-based two-factor auth
- **Telegram & Email Notifications** — Real-time trade alerts and daily digests
- **Screenshot Capture** — Automatic chart screenshots via Twelve Data

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, glassmorphic dark theme
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js v5 with TOTP 2FA
- **Charts:** Recharts
- **Notifications:** Telegram Bot API, Resend (email)

## Quick Start

### Docker (recommended)

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/prismjournal.git
cd prismjournal

# Copy and configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Seed reference data (prop firms)
docker exec prod_app npx tsx prisma/seed-prop-firms.ts
```

### Local Development

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

App runs at `http://localhost:3000`

## Environment Variables

Copy `.env.example` to `.env`. Required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Session encryption key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public URL of your instance |

Optional variables for additional features are documented in `.env.example`.

## MT5 Integration

1. Copy `server/workers/PrismSync.mq5` to your MT5 `Experts` folder
2. Set the `SyncUrl` to `https://your-domain.com/api/sync`
3. Get your Bridge Key from Settings > Connector Hub in the app
4. Attach the EA to any chart — trades sync automatically

## Contributing

Contributions are welcome! Please open an issue first to discuss proposed changes.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
