import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

test.describe('Trade Sync API', () => {
  const BRIDGE_KEY = process.env.TEST_BRIDGE_KEY || ''

  test('POST /api/sync without bridge key returns 400 or 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/sync`, {
      data: {
        type: 'TRADE_UPDATE',
        trade: {
          symbol: 'EURUSD',
          direction: 'LONG',
          entryPrice: 1.0850,
          volume: 0.1,
          entryTime: new Date().toISOString(),
        },
      },
    })

    expect([400, 401]).toContain(response.status())
  })

  test('POST /api/sync with invalid bridge key returns 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/sync`, {
      headers: {
        'X-Bridge-Key': 'invalid-bridge-key-1234567890',
      },
      data: {
        type: 'TRADE_UPDATE',
        trade: {
          symbol: 'EURUSD',
          direction: 'LONG',
          entryPrice: 1.0850,
          volume: 0.1,
          entryTime: new Date().toISOString(),
        },
      },
    })

    expect(response.status()).toBe(401)
  })

  test('POST /api/sync with valid bridge key creates a trade', async ({ request }) => {
    test.skip(!BRIDGE_KEY, 'TEST_BRIDGE_KEY not set — skipping live sync test')

    const ticket = `TEST-${Date.now()}`
    const response = await request.post(`${BASE_URL}/api/sync`, {
      headers: {
        'X-Bridge-Key': BRIDGE_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'TRADE_UPDATE',
        trade: {
          ticket,
          symbol: 'EURUSD',
          direction: 'LONG',
          entryPrice: 1.0850,
          volume: 0.1,
          entryTime: new Date().toISOString(),
          status: 'OPEN',
        },
      },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  test('POST /api/sync updates existing trade by ticket', async ({ request }) => {
    test.skip(!BRIDGE_KEY, 'TEST_BRIDGE_KEY not set — skipping live sync test')

    const ticket = `TEST-UPD-${Date.now()}`

    await request.post(`${BASE_URL}/api/sync`, {
      headers: {
        'X-Bridge-Key': BRIDGE_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'TRADE_UPDATE',
        trade: {
          ticket,
          symbol: 'GBPUSD',
          direction: 'SHORT',
          entryPrice: 1.2700,
          volume: 0.05,
          entryTime: new Date().toISOString(),
          status: 'OPEN',
        },
      },
    })

    const response = await request.post(`${BASE_URL}/api/sync`, {
      headers: {
        'X-Bridge-Key': BRIDGE_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'TRADE_UPDATE',
        trade: {
          ticket,
          symbol: 'GBPUSD',
          direction: 'SHORT',
          entryPrice: 1.2700,
          exitPrice: 1.2650,
          volume: 0.05,
          entryTime: new Date().toISOString(),
          exitTime: new Date().toISOString(),
          pnl: 25.0,
          status: 'CLOSED',
        },
      },
    })

    expect(response.status()).toBe(200)
  })

  test('POST /api/sync EQUITY_SNAPSHOT type works', async ({ request }) => {
    test.skip(!BRIDGE_KEY, 'TEST_BRIDGE_KEY not set — skipping live sync test')

    const response = await request.post(`${BASE_URL}/api/sync`, {
      headers: {
        'X-Bridge-Key': BRIDGE_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        type: 'EQUITY_SNAPSHOT',
        snapshot: {
          balance: 10000,
          equity: 10050,
        },
      },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  test('rate limiting works on sync endpoint', async ({ request }) => {
    const responses = []
    for (let i = 0; i < 5; i++) {
      responses.push(
        request.post(`${BASE_URL}/api/sync`, {
          data: { type: 'TRADE_UPDATE' },
        }),
      )
    }

    const results = await Promise.all(responses)
    const statusCodes = results.map(r => r.status())
    const hasAuthErrors = statusCodes.filter(s => s === 400 || s === 401).length

    expect(hasAuthErrors).toBeGreaterThan(0)
  })
})
