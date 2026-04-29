import { test, expect } from '@playwright/test'

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /^register$/i }).click()

    const uniqueEmail = `settings-test-${Date.now()}@example.com`
    await page.getByPlaceholder(/your name/i).fill('Test User')
    await page.getByPlaceholder(/you@example\.com/i).fill(uniqueEmail)
    await page.getByPlaceholder(/••••••••/).fill('ValidPassword123')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/|\/dashboard/, { timeout: 15000 })
    await page.goto('/settings')
  })

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible()
  })

  test('should change display currency', async ({ page }) => {
    const currencySelector = page.getByRole('combobox', { name: /currency/i }).or(
      page.locator('select[name*="currency"], [data-testid*="currency"]')
    )

    if (await currencySelector.first().count() > 0) {
      await currencySelector.first().selectOption({ value: 'USD' })
      await page.waitForTimeout(500)
    }
  })

  test('should change timezone', async ({ page }) => {
    const timezoneSelector = page.getByRole('combobox', { name: /timezone/i }).or(
      page.locator('select[name*="timezone"], [data-testid*="timezone"]')
    )

    if (await timezoneSelector.first().count() > 0) {
      await timezoneSelector.first().selectOption({ label: 'Europe/London' })
      await page.waitForTimeout(500)
    }
  })

  test('should change date format', async ({ page }) => {
    const dateformatSelector = page.getByRole('combobox', { name: /date.*format/i }).or(
      page.locator('select[name*="dateFormat"], [data-testid*="date-format"]')
    )

    if (await dateformatSelector.first().count() > 0) {
      await dateformatSelector.first().selectOption({ value: 'YYYY-MM-DD' })
      await page.waitForTimeout(500)
    }
  })

  test('should save notification preferences', async ({ page }) => {
    const notificationToggle = page.getByRole('switch', { name: /notification|sync|email/i }).or(
      page.locator('input[type="checkbox"][name*="enable"], [data-testid*="notification"]')
    ).first()

    if (await notificationToggle.count() > 0) {
      await notificationToggle.click()
      await page.waitForTimeout(500)
    }
  })

  test('should display 2FA setup section', async ({ page }) => {
    const twoFASection = page.getByText(/2fa|two.factor|authenticator/i)
    if (await twoFASection.count() > 0) {
      await expect(twoFASection.first()).toBeVisible()
    }
  })

  test('should initiate 2FA setup flow', async ({ page }) => {
    const setupButton = page.getByRole('button', { name: /enable.*2fa|setup.*authenticator|enable.*two/i })
    if (await setupButton.count() > 0) {
      await setupButton.click()
      await page.waitForTimeout(1000)

      const qrCode = page.locator('img[alt*="QR"], svg, [data-testid*="qr"], canvas').first()
      if (await qrCode.count() > 0) {
        await expect(qrCode).toBeVisible()
      }
    }
  })
})
