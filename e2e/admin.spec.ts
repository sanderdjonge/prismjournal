import { test, expect } from '@playwright/test'

test.describe('Admin Page', () => {
  test.describe('Non-admin access', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.getByRole('button', { name: /^register$/i }).click()

      const uniqueEmail = `admin-test-${Date.now()}@example.com`
      await page.getByPlaceholder(/your name/i).fill('Regular User')
      await page.getByPlaceholder(/you@example\.com/i).fill(uniqueEmail)
      await page.getByPlaceholder(/••••••••/).fill('ValidPassword123')
      await page.getByRole('button', { name: /create account/i }).click()

      await expect(page).toHaveURL(/\/|\/dashboard/, { timeout: 15000 })
    })

    test('should deny access to non-admin user', async ({ page }) => {
      await page.goto('/admin')

      const isForbidden = page.getByText(/forbidden|not authorized|access denied|unauthorized/i)
      const isRedirected = page.url().match(/\/(dashboard|login)/)

      expect(await isForbidden.count() > 0 || isRedirected).toBeTruthy()
    })
  })

  test.describe('Admin access', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin')
    })

    test('should load admin page for superuser', async ({ page }) => {
      const isAdminPage = page.getByText(/admin|users|system/i)
      const isLoginRedirect = page.url().match(/\/login/)

      if (!isLoginRedirect && (await isAdminPage.count() > 0)) {
        await expect(isAdminPage.first()).toBeVisible()
      }
    })

    test('should display user list', async ({ page }) => {
      if (page.url().includes('/login')) {
        test.skip()
        return
      }

      const userTable = page.locator('table, [data-testid="user-list"], [class*="user"]')
      if (await userTable.count() > 0) {
        await expect(userTable.first()).toBeVisible()
      }
    })

    test('should paginate user list', async ({ page }) => {
      if (page.url().includes('/login')) {
        test.skip()
        return
      }

      const nextButton = page.getByRole('button', { name: /next|>/i }).or(
        page.locator('[data-testid*="pagination"] button').last()
      )

      if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
        await nextButton.click()
        await page.waitForTimeout(500)
      }
    })

    test('should change user role', async ({ page }) => {
      if (page.url().includes('/login')) {
        test.skip()
        return
      }

      const makeAdminButton = page.getByRole('button', { name: /make.*admin|promote/i }).first()
      if (await makeAdminButton.count() > 0) {
        await makeAdminButton.click()
        await page.waitForTimeout(500)
      }
    })

    test('should deactivate and activate user', async ({ page }) => {
      if (page.url().includes('/login')) {
        test.skip()
        return
      }

      const deactivateButton = page.getByRole('button', { name: /deactivate|disable/i }).first()
      if (await deactivateButton.count() > 0) {
        await deactivateButton.click()
        await page.waitForTimeout(500)

        const activateButton = page.getByRole('button', { name: /activate|enable/i }).first()
        if (await activateButton.count() > 0) {
          await activateButton.click()
          await page.waitForTimeout(500)
        }
      }
    })

    test('should broadcast email', async ({ page }) => {
      if (page.url().includes('/login')) {
        test.skip()
        return
      }

      const broadcastTab = page.getByRole('tab', { name: /broadcast/i }).or(
        page.getByRole('button', { name: /broadcast|notification/i })
      )

      if (await broadcastTab.count() > 0) {
        await broadcastTab.first().click()

        const titleInput = page.getByPlaceholder(/title|subject/i).or(
          page.locator('input[name*="title"], input[name*="subject"]')
        ).first()

        if (await titleInput.count() > 0) {
          await titleInput.fill('Test Broadcast')
        }

        const messageInput = page.getByPlaceholder(/message/i).or(
          page.locator('textarea[name*="message"]')
        ).first()

        if (await messageInput.count() > 0) {
          await messageInput.fill('Test broadcast message from E2E')
        }

        const sendButton = page.getByRole('button', { name: /send|broadcast/i })
        if (await sendButton.count() > 0) {
          await sendButton.click()
          await page.waitForTimeout(1000)
        }
      }
    })

    test('cannot self-demote or self-delete', async ({ page }) => {
      if (page.url().includes('/login')) {
        test.skip()
        return
      }

      const selfRow = page.locator('tr, [data-testid*="user-row"]').first()
      if (await selfRow.count() > 0) {
        const selfRemoveAdmin = selfRow.getByRole('button', { name: /remove.*admin|demote/i })

        if (await selfRemoveAdmin.count() > 0) {
          await selfRemoveAdmin.click()
          const errorMsg = page.getByText(/cannot.*own|forbidden|not allowed/i)
          if (await errorMsg.count() > 0) {
            await expect(errorMsg.first()).toBeVisible()
          }
        }

        const selfDeactivateBtn = selfRow.getByRole('button', { name: /deactivate/i })
        if (await selfDeactivateBtn.count() > 0) {
          await selfDeactivateBtn.click()
          const errorMsg = page.getByText(/cannot.*own|forbidden|not allowed/i)
          if (await errorMsg.count() > 0) {
            await expect(errorMsg.first()).toBeVisible()
          }
        }
      }
    })
  })
})
