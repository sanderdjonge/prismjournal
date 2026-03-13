# PrismJournal 2.0 (Development)

> **Next-Generation Trading Journal** - Combining the best of PrismJournal and TradeLens

## Overview

PrismJournal 2.0 is a comprehensive trading journal application designed for professional traders. This development version combines the robust MT5 integration and glassmorphic UI from PrismJournal with the advanced analytics, 2FA authentication, and prop firm support from TradeLens.

## Key Features

### From PrismJournal (Base)
- **PrismSync EA v3.0** - MT5 integration for automated trade synchronization
- **Black + Neon Glassmorphic UI** - Modern, dark-themed interface
- **Telegram & Email Notifications** - Real-time alerts via Resend
- **Multi-Currency Support** - Automatic currency conversion

### From TradeLens (Integrated)
- **TOTP 2FA Authentication** - Secure your account with authenticator apps
- **Prop Firm Account Support** - Track challenges, phases, and rules
- **Advanced Analytics** - Comprehensive metrics and performance tracking
- **Static Responsive Dashboard** - Clean, predictable layout (no draggable widgets)

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Glassmorphic design system
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with 2FA support
- **Charts**: Recharts, Lightweight Charts
- **Notifications**: Resend (email), Telegram Bot API

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL (or use Docker)

### Quick Start with Docker

```bash
# Start development environment
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f app

# Stop environment
docker compose -f docker-compose.dev.yml down
```

The app will be available at `http://localhost:3002`

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the database (optional)
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://prism_dev:prism_dev_password@localhost:5433/prism_journal_dev"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3002"

# AI Features (Optional)
NEBUL_API_KEY="your-nebul-api-key"
NEBUL_BASE_URL="https://api.inference.nebul.io/v1"
NEBUL_MODEL="Qwen/Qwen3.5-397B-A17B"

# Notifications (Optional)
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
RESEND_API_KEY="your-resend-api-key"

# Cron Jobs
CRON_SECRET="your-cron-secret"
```

## Project Structure

```
Prismjournal-dev/
├── prisma/
│   └── schema.prisma      # Database schema (merged from both projects)
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── 2fa/       # 2FA setup, verify, disable
│   │   │   ├── dashboard/ # Dashboard data
│   │   │   └── sync/      # MT5 sync endpoint
│   │   └── page.tsx       # Main dashboard page
│   ├── components/
│   │   ├── auth/          # Authentication components
│   │   │   └── TwoFactorSetup.tsx
│   │   ├── dashboard/     # Dashboard components
│   │   │   ├── Dashboard.tsx  # Static responsive layout
│   │   │   ├── EquityChart.tsx
│   │   │   ├── Gauge.tsx
│   │   │   ├── RecentTrades.tsx
│   │   │   └── TradeCalendar.tsx
│   │   └── layout/        # Layout components
│   └── lib/
│       ├── auth.ts        # NextAuth configuration with 2FA
│       ├── prisma.ts      # Prisma client
│       └── cn.ts          # Class name utility
├── server/
│   └── workers/
│       └── PrismSync.mq5  # MT5 Expert Advisor
├── docker-compose.dev.yml # Development Docker config
└── Dockerfile             # Production-ready container
```

## Database Schema

The schema has been merged from both projects:

### Key Models

- **User** - User accounts with 2FA support (`totpSecret`, `totpEnabled`)
- **TradingAccount** - Trading accounts with prop firm support
  - `accountType`: `PROPFIRM` or `OWN_MONEY`
  - Prop firm fields: `maxDailyLoss`, `maxTotalDrawdown`, `profitTarget`, `currentPhase`
- **Trade** - Trade records with comprehensive analytics
  - Direction: `LONG` or `SHORT`
  - Status: `OPEN`, `CLOSED`, `CANCELLED`
  - Source: `PAPER`, `LIVE`, `MANUAL`
  - Platform: `TRADINGVIEW`, `METATRADER5`, `MANUAL`
- **Strategy** - Trading strategies
- **CustomStat** - Custom statistics with filter configurations
- **SystemMetric** - Admin system metrics

## API Endpoints

### Authentication
- `POST /api/2fa/setup` - Initialize 2FA setup
- `POST /api/2fa/verify` - Verify and enable 2FA
- `POST /api/2fa/disable` - Disable 2FA

### Dashboard
- `GET /api/dashboard` - Get dashboard data (equity, trades, calendar, metrics)

### MT5 Sync
- `POST /api/sync` - Receive trade data from PrismSync EA

## MT5 Integration

The PrismSync EA (located in `server/workers/PrismSync.mq5`) automatically syncs trades from MT5:

1. Install the EA on your MT5 terminal
2. Configure the bridge key from your account settings
3. Trades are automatically synced in real-time

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Sprint 1 Changes

This version includes the following Sprint 1 changes:

1. ✅ **Removed draggable/resizable widgets** - Replaced with static responsive grid layout
2. ✅ **Merged Prisma schema** - Combined fields from both projects
3. ✅ **Implemented 2FA authentication** - TOTP-based two-factor auth
4. ✅ **Added prop firm account model** - Support for prop firm challenges
5. ✅ **Containerized with Docker** - Ready for deployment

## Upcoming Features (Sprint 2+)

- [ ] TradeLens-style analytics page
- [ ] Redesigned calendar view
- [ ] Psychology tracking section
- [ ] Admin panel with system statistics
- [ ] Custom statistics builder

## Documentation

For comprehensive documentation, see the `docs/` folder in the parent directory:

- [Project Integration Guide](../docs/PROJECT_INTEGRATION_GUIDE.md)
- [PrismJournal Documentation](../docs/PRISMJOURNAL_DOCUMENTATION.md)
- [TradeLens Documentation](../docs/TRADELENS_DOCUMENTATION.md)

## License

Private project - All rights reserved
