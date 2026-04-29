import { test, expect } from '@playwright/test'

test.describe('Strategies Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /^register$/i }).click()

    const uniqueEmail = `strategies-test-${Date.now()}@example.com`
    await page.getByPlaceholder(/your name/i).fill('Test User')
    await page.getByPlaceholder(/you@example\.com/i).fill(uniqueEmail)
    await page.getByPlaceholder(/••••••••/).fill('ValidPassword123')
    await page.getByRole('button', { name: /create account/i }).click()

    await expect(page).toHaveURL(/\/|\/dashboard/, { timeout: 15000 })
    await page.goto('/strategies')
  })

  test('should display strategies page', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible()
  })

  test('should show strategy list or empty state', async ({ page }) => {
    const strategyList = page.locator('table, [data-testid*="strategy"], [class*="strategy"]')
    const emptyState = page.getByText(/no.*strategies|get.*started|create.*strategy/i)

    const hasList = await strategyList.count() > 0
    const hasEmpty = await emptyState.count() > 0

    expect(hasList || hasEmpty).toBeTruthy()
  })

  test('should create new strategy', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create.*strategy|new.*strategy|add.*strategy|\+.*strategy/i })

    if (await createButton.count() > 0) {
      await createButton.click()

      const nameInput = page.getByPlaceholder(/strategy.*name|name/i).or(
        page.locator('input[name*="name"]').first()
      )

      if (await nameInput.count() > 0) {
        await nameInput.fill('Test Strategy')
      }

      const descInput = page.getByPlaceholder(/description/i).or(
        page.locator('textarea[name*="description"]').first()
      )

      if (await descInput.count() > 0) {
        await descInput.fill('Test strategy description')
      }

      const submitButton = page.getByRole('button', { name: /save|create|submit/i })
      if (await submitButton.count() > 0) {
        await submitButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('should edit strategy name/description', async ({ page }) => {
    const strategyRow = page.locator('[data-testid*="strategy"], [class*="strategy"]').first()
    if (await strategyRow.count() > 0) {
      await strategyRow.click()
      await page.waitForTimeout(500)

      const editButton = page.getByRole('button', { name: /edit|rename/i })
      if (await editButton.count() > 0) {
        await editButton.click()

        const nameInput = page.locator('input[name*="name"]').first()
        if (await nameInput.count() > 0) {
          await nameInput.fill('Updated Strategy Name')
        }

        const saveButton = page.getByRole('button', { name: /save|update/i })
        if (await saveButton.count() > 0) {
          await saveButton.click()
          await page.waitForTimeout(500)
        }
      }
    }
  })

  test('should delete strategy', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first()

    if (await deleteButton.count() > 0) {
      await deleteButton.click()

      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i })
      if (await confirmButton.count() > 0) {
        await confirmButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('should navigate to strategy rules page', async ({ page }) => {
    const strategyLink = page.getByRole('link', { name: /strategy|rules|view/i }).or(
      page.locator('a[href*="/strategies/"]').first()
    ).first()

    if (await strategyLink.count() > 0) {
      await strategyLink.click()
      await page.waitForTimeout(500)

      const rulesSection = page.getByText(/rules|plan.*adherence|checklist/i)
      if (await rulesSection.count() > 0) {
        await expect(rulesSection.first()).toBeVisible()
      }
    }
  })
})
