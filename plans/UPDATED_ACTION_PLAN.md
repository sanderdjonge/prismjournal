# PrismJournal - Updated Action Plan

> **Review Date:** 2026-03-12
> **Previous Review:** docs/ARCHITECTURAL_REVIEW.md
> **Status:** Progress Update

---

## Executive Summary

Since the original architectural review, significant progress has been made on P1 and P2 priority items. This document outlines what has been completed and provides an updated action plan for remaining issues.

---

## Completed Improvements

### P1 Items - COMPLETED

#### 1. Input Validation - DONE
Zod validation schemas have been implemented across the application:

| File | Purpose |
|------|---------|
| [`src/lib/validations/auth.ts`](src/lib/validations/auth.ts) | Registration and login validation |
| [`src/lib/validations/trade.ts`](src/lib/validations/trade.ts) | Trade creation, update, and file upload validation |
| [`src/lib/validations/settings.ts`](src/lib/validations/settings.ts) | User settings and notification settings validation |
| [`src/lib/validations/sync.ts`](src/lib/validations/sync.ts) | MT5 sync payload validation |
| [`src/lib/validations/common.ts`](src/lib/validations/common.ts) | Shared validation utilities |

API routes now use these validations:
- [`src/app/api/auth/register/route.ts`](src/app/api/auth/register/route.ts:9) - Uses `registerSchema`
- [`src/app/api/trades/route.ts`](src/app/api/trades/route.ts:5) - Uses `tradeCreateSchema`
- [`src/app/api/sync/route.ts`](src/app/api/sync/route.ts:6) - Uses `syncPayloadSchema`

#### 2. Test Infrastructure - DONE
Testing frameworks are now configured and tests exist:

| Type | Config | Tests |
|------|--------|-------|
| Unit Tests | [`vitest.config.ts`](vitest.config.ts) | [`src/__tests__/lib/`](src/__tests__/lib/) |
| E2E Tests | [`playwright.config.ts`](playwright.config.ts) | [`e2e/`](e2e/) |

**Unit Test Coverage:**
- Auth validation tests (registration, login)
- Trade validation tests (create, update, file upload)
- Settings validation tests (user settings, notifications)
- Sync validation tests (MT5 sync payloads)
- Rate limiting tests (all limiters, IP detection, time windows)
- Analytics tests (profit factor, expectancy, tiltmeter, edge stability)

**E2E Test Coverage:**
- [`e2e/auth.spec.ts`](e2e/auth.spec.ts) - Authentication flow (login, register, logout, protected routes)
- [`e2e/dashboard.spec.ts`](e2e/dashboard.spec.ts) - Dashboard widgets, metrics, navigation, responsive design
- [`e2e/journal.spec.ts`](e2e/journal.spec.ts) - Journal page, trade filtering, trade analysis, pagination

#### 3. CI/CD Pipeline - DONE
GitHub Actions workflow implemented at [`.github/workflows/test.yml`](.github/workflows/test.yml):

**Jobs:**
1. **Unit Tests** - Runs Vitest tests with coverage report
2. **E2E Tests** - Runs Playwright tests with PostgreSQL service container
3. **Lint** - Runs ESLint
4. **Type Check** - Runs TypeScript compiler

**Features:**
- Triggers on push/PR to `main` and `develop` branches
- PostgreSQL 15 service container for E2E tests
- Playwright browser installation with dependencies
- Coverage reports uploaded as artifacts
- Playwright reports and screenshots on failure

---

### P2 Items - COMPLETED

#### 1. Database Indexes - DONE
Migration [`prisma/migrations/20260312091822_add_performance_indexes/migration.sql`](prisma/migrations/20260312091822_add_performance_indexes/migration.sql) added:

```sql
CREATE INDEX "EquitySnapshot_accountId_timestamp_idx" ON "EquitySnapshot"("accountId", "timestamp");
CREATE INDEX "Trade_accountId_idx" ON "Trade"("accountId");
CREATE INDEX "Trade_accountId_entryTime_idx" ON "Trade"("accountId", "entryTime");
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");
```

#### 2. Rate Limiting - DONE
[`src/lib/rate-limit.ts`](src/lib/rate-limit.ts) implements in-memory rate limiting with:
- `authLimiter` - 5 requests/minute for registration
- `loginLimiter` - 10 requests/minute for login
- `apiLimiter` - 100 requests/minute for general API
- `syncLimiter` - 100 requests/minute for MT5 sync
- `passwordLimiter` - 3 requests/minute for password operations

Integrated in [`src/middleware.ts`](src/middleware.ts:15-39) for all API routes.

#### 3. Large Component Refactoring - DONE
Components have been extracted into smaller units:

**TradeAnalysisDrawer** → [`src/components/journal/trade-analysis/`](src/components/journal/trade-analysis/)
- [`Lightbox.tsx`](src/components/journal/trade-analysis/Lightbox.tsx) - Image lightbox component
- [`ScreenshotUploader.tsx`](src/components/journal/trade-analysis/ScreenshotUploader.tsx) - File upload handling
- [`MoodSelector.tsx`](src/components/journal/trade-analysis/MoodSelector.tsx) - Mood selection UI
- [`ComplianceSelector.tsx`](src/components/journal/trade-analysis/ComplianceSelector.tsx) - Plan compliance UI
- [`TradeNotes.tsx`](src/components/journal/trade-analysis/TradeNotes.tsx) - Notes editor

**TradeEntryModal** → [`src/components/journal/trade-entry/`](src/components/journal/trade-entry/)
- [`TradeFormFields.tsx`](src/components/journal/trade-entry/TradeFormFields.tsx) - Form input fields
- [`TradeEntryDetails.tsx`](src/components/journal/trade-entry/TradeEntryDetails.tsx) - Entry details section
- [`RiskCalculator.tsx`](src/components/journal/trade-entry/RiskCalculator.tsx) - Risk calculation
- [`TradeFormActions.tsx`](src/components/journal/trade-entry/TradeFormActions.tsx) - Form action buttons

**DraggableTable** → [`src/components/journal/trade-table/`](src/components/journal/trade-table/)
- [`TableHeader.tsx`](src/components/journal/trade-table/TableHeader.tsx) - Table header with sorting
- [`TradeRow.tsx`](src/components/journal/trade-table/TradeRow.tsx) - Individual row rendering
- [`PaginationControls.tsx`](src/components/journal/trade-table/PaginationControls.tsx) - Pagination UI
- [`ColumnVisibilityToggle.tsx`](src/components/journal/trade-table/ColumnVisibilityToggle.tsx) - Column visibility

#### 4. Server-Side Filtering - DONE
[`src/app/api/trades/route.ts`](src/app/api/trades/route.ts:8-75) now supports:
- Symbol filtering (`?symbol=XAUUSD`)
- Side filtering (`?side=BUY`)
- Result filtering (`?result=WIN`)
- Date range filtering (`?from=2026-01-01&to=2026-03-12`)
- Search (`?q=searchterm`)
- Pagination (`?page=1&limit=50`)

---

## Remaining Issues

### P3 - Medium Priority

#### 1. Screenshot Storage in Database
**Current State:** Screenshots stored as base64 in [`Media`](prisma/schema.prisma) model  
**Location:** [`src/app/api/trades/[id]/upload/route.ts`](src/app/api/trades/[id]/upload/route.ts:25-27)

**Impact:**
- Database bloat
- Slower backups
- Degraded query performance

**Recommended Solution:**
```
Option A: File system storage in public/uploads/
Option B: Object storage (S3, MinIO, Cloudflare R2)
```

**Tasks:**
- [ ] Create file storage service
- [ ] Migrate existing base64 images to files
- [ ] Update upload route to save files
- [ ] Update Media model to store file paths
- [ ] Create migration script for existing data

---

#### 2. Currency Normalization Not Implemented
**Current State:** [`Currency`](prisma/schema.prisma) and [`ExchangeRate`](prisma/schema.prisma) models exist but unused  
**Location:** [`src/lib/currency.tsx`](src/lib/currency.tsx) only handles display formatting

**Impact:**
- Analytics show mixed currency P&L
- Inaccurate performance metrics

**Tasks:**
- [ ] Create exchange rate fetching service
- [ ] Add scheduled job to update rates
- [ ] Implement P&L normalization in analytics
- [ ] Add base currency setting to UserSettings

---

#### 3. Plain-Text Bridge Keys
**Current State:** Bridge keys stored in plain text in [`Account.bridgeKey`](prisma/schema.prisma:33)  
**Location:** [`src/app/api/sync/route.ts`](src/app/api/sync/route.ts:14-20)

**Impact:**
- Database compromise exposes all MT5 connections

**Tasks:**
- [ ] Create hashing utility for bridge keys
- [ ] Update account creation to hash bridge keys
- [ ] Update sync route to compare hashed values
- [ ] Create migration to hash existing keys

---

#### 4. No Caching Strategy
**Current State:** No caching implemented for frequently accessed data

**Impact:**
- Repeated database queries for static data
- Slower response times

**Tasks:**
- [ ] Add React Query or SWR for client-side caching
- [ ] Consider Redis for server-side caching
- [ ] Cache user settings, account info, trade statistics

---

### P4 - Low Priority

#### 1. Empty Directories
**Locations:**
- `src/components/forms/`
- `src/components/dashboard/widgets/`
- `src/components/widgets/`

**Tasks:**
- [ ] Remove empty directories OR implement planned components

---

#### 2. Server Directory Location
**Current State:** [`server/utils/analytics_compute.ts`](server/utils/analytics_compute.ts) exists outside `src/`

**Tasks:**
- [ ] Move to `src/lib/analytics.ts`
- [ ] Update any imports

---

### Additional Improvements

#### 1. Service Layer Extraction
**Current State:** [`src/app/api/sync/route.ts`](src/app/api/sync/route.ts) handles multiple concerns

**Recommended Structure:**
```
src/lib/services/
├── trade-sync.service.ts    # Trade upsert logic
├── equity.service.ts         # Equity snapshot handling
├── notification.service.ts   # Telegram/email notifications
└── alert.service.ts          # MDD alerts
```

**Tasks:**
- [ ] Create service layer directory
- [ ] Extract trade sync logic
- [ ] Extract equity snapshot logic
- [ ] Extract notification logic
- [ ] Refactor sync route to use services

---

#### 2. Standardized Error Handling
**Current State:** Inconsistent error responses across API routes

**Tasks:**
- [ ] Create error response format
- [ ] Create centralized error logging
- [ ] Add request IDs for debugging
- [ ] Update all API routes

---

#### 3. Frontend Form Validation
**Current State:** Forms use API validation but not client-side react-hook-form

**Tasks:**
- [ ] Install react-hook-form and @hookform/resolvers
- [ ] Integrate Zod schemas with forms
- [ ] Add client-side validation feedback

---

## Priority Matrix - Updated

| Issue | Severity | Effort | Priority | Status |
|-------|----------|--------|----------|--------|
| Input Validation | High | Medium | P1 | DONE |
| Test Infrastructure | High | High | P1 | DONE |
| Database Indexes | Medium | Low | P2 | DONE |
| Client-Side Filtering | Medium | Medium | P2 | DONE |
| Rate Limiting | Medium | Low | P2 | DONE |
| Large Component Files | Medium | Medium | P2 | DONE |
| Screenshot Storage | Medium | Medium | P3 | Pending |
| Currency Normalization | Medium | High | P3 | Pending |
| Plain-Text Bridge Keys | Medium | Low | P3 | Pending |
| No Caching Strategy | Medium | Medium | P3 | Pending |
| Service Layer Extraction | Medium | Medium | P3 | Pending |
| Standardized Error Handling | Medium | Low | P4 | Pending |
| Empty Directories | Low | Low | P4 | Pending |
| Server Directory Location | Low | Low | P4 | Pending |

---

## Recommended Next Steps

### Immediate (P3)

1. **Screenshot Storage Migration** - Most impactful for database performance
2. **Bridge Key Hashing** - Security improvement, low effort
3. **Caching Strategy** - Performance improvement

### Short-term (P4)

1. **Service Layer Extraction** - Improves maintainability
2. **Standardized Error Handling** - Improves debugging
3. **Clean up empty directories** - Reduces confusion

### Optional Enhancements

1. **Currency Normalization** - If multi-currency support is needed
2. **Frontend Form Validation** - Better UX with client-side validation

---

## Questions for Discussion

1. **Screenshot Storage:** Should we use local file storage or cloud object storage (S3/R2)?
2. **Caching:** Is Redis worth the operational complexity, or is in-memory caching sufficient?
3. **Currency Normalization:** Is this a priority feature for your users?
4. **Service Layer:** Should we prioritize this refactoring or focus on new features?
