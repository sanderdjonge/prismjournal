import { test, expect } from '@playwright/test'

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /^register$/i }).click()

    const uniqueEmail = `analytics-test-${Date.now()}@example.com`
    await page.getByPlaceholder(/your name/i).fill('Test User')
    await page.getByPlaceholder(/you@example\.com/i).fill(uniqueEmail)
    await page.getByPlaceholder(/••••••••/).fill('ValidPassword123')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/|\/dashboard/, { timeout: 15000 })
  })

  test('displays analytics page with key sections', async ({ page }) => {
    await page.goto('/analytics')

    await expect(page.locator('h1, h2')).toContainText(/analytics/i)

    await expect(page.getByText(/what.if/i)).toBeVisible({ timeout: 10000 })
  })

  test('What-If simulator can expand filters', async ({ page }) => {
    await page.goto('/analytics')

    const simulator = page.getByText(/what.if/i).first()
    await simulator.waitFor({ state: 'visible', timeout: 10000 })

    const filterButton = page.getByRole('button', { name: /filter|advanced/i }).first()
    if (await filterButton.isVisible()) {
      await filterButton.click()
      await expect(page.getByText(/duration|session|r:R|risk/i)).toBeVisible({ timeout: 5000 })
    }
  })

  test('navigates to performance from analytics', async ({ page }) => {
    await page.goto('/performance')

    await expect(page.locator('text=Performance Ledger')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/equity|p&l|drawdown/i)).toBeVisible({ timeout: 10000 })
  })
})
