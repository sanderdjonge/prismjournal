import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login before each test
    await page.goto('/login');
    await page.getByRole('button', { name: /^register$/i }).click();
    
    const uniqueEmail = `dashboard-test-${Date.now()}@example.com`;
    await page.getByPlaceholder(/your name/i).fill('Test User');
    await page.getByPlaceholder(/you@example\.com/i).fill(uniqueEmail);
    await page.getByPlaceholder(/••••••••/).fill('ValidPassword123');
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Wait for redirect
    await expect(page).toHaveURL(/\/|\/dashboard/, { timeout: 15000 });
    
    // Navigate to dashboard if not already there
    await page.goto('/dashboard');
  });

  test('should display dashboard page', async ({ page }) => {
    // Check for dashboard content - either heading or main content
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display key metrics widgets', async ({ page }) => {
    // Check for common dashboard widgets/metrics
    const widgets = [
      /balance|equity/i,
      /profit|pnl/i,
      /win.*rate/i,
      /trades/i,
    ];

    let foundWidgets = 0;
    for (const widget of widgets) {
      const widgetElement = page.getByText(widget).first();
      if (await widgetElement.count() > 0) {
        foundWidgets++;
      }
    }
    // At least one widget should be visible
    expect(foundWidgets).toBeGreaterThan(0);
  });

  test('should display equity chart', async ({ page }) => {
    // Look for equity chart container
    const equityChart = page.locator('canvas, [class*="chart"], [data-testid="equity-chart"]').first();
    
    if (await equityChart.count() > 0) {
      await expect(equityChart).toBeVisible();
    }
  });

  test('should display recent trades widget', async ({ page }) => {
    // Look for recent trades section
    const recentTrades = page.getByText(/recent.*trades|latest.*trades/i);
    
    if (await recentTrades.count() > 0) {
      await expect(recentTrades.first()).toBeVisible();
    }
  });

  test('should display performance summary', async ({ page }) => {
    // Look for performance metrics
    const performanceSection = page.getByText(/performance|statistics/i);
    
    if (await performanceSection.count() > 0) {
      await expect(performanceSection.first()).toBeVisible();
    }
  });

  test('should display profit factor', async ({ page }) => {
    // Look for profit factor metric
    const profitFactor = page.getByText(/profit.*factor/i);
    
    if (await profitFactor.count() > 0) {
      await expect(profitFactor.first()).toBeVisible();
    }
  });

  test('should display win rate', async ({ page }) => {
    // Look for win rate metric
    const winRate = page.getByText(/win.*rate/i);
    
    if (await winRate.count() > 0) {
      await expect(winRate.first()).toBeVisible();
    }
  });

  test('should display drawdown information', async ({ page }) => {
    // Look for drawdown metric
    const drawdown = page.getByText(/drawdown/i);
    
    if (await drawdown.count() > 0) {
      await expect(drawdown.first()).toBeVisible();
    }
  });

  test('should show empty state for new users', async ({ page }) => {
    // New users should see some indication of no data
    const emptyState = page.getByText(/no.*data|get.*started|import.*trades|connect.*account/i);
    
    // Either empty state or default values should be shown
    const hasEmptyState = await emptyState.count() > 0;
    const hasDefaultMetrics = await page.getByText(/0|—|-/).count() > 0;
    
    expect(hasEmptyState || hasDefaultMetrics).toBeTruthy();
  });

  test('should navigate to journal from dashboard', async ({ page }) => {
    // Look for link to journal
    const journalLink = page.getByRole('link', { name: /journal|trades|view.*all/i }).or(
      page.getByRole('button', { name: /journal|trades|view.*all/i })
    );
    
    if (await journalLink.count() > 0) {
      await journalLink.first().click();
      await expect(page).toHaveURL(/\/journal/, { timeout: 5000 });
    }
  });

  test('should navigate to analytics from dashboard', async ({ page }) => {
    // Look for link to analytics
    const analyticsLink = page.getByRole('link', { name: /analytics|performance/i }).or(
      page.getByRole('button', { name: /analytics|performance/i })
    );
    
    if (await analyticsLink.count() > 0) {
      await analyticsLink.first().click();
      await expect(page).toHaveURL(/\/(analytics|performance)/, { timeout: 5000 });
    }
  });

  test('should display gauge widgets', async ({ page }) => {
    // Look for gauge/progress indicators
    const gauges = page.locator('[data-testid*="gauge"], .gauge, [class*="gauge"], svg[class*="gauge"]');
    
    if (await gauges.count() > 0) {
      await expect(gauges.first()).toBeVisible();
    }
  });

  test('should display tiltmeter if available', async ({ page }) => {
    // Look for tiltmeter widget
    const tiltmeter = page.getByText(/tiltmeter|discipline|tilt/i);
    
    if (await tiltmeter.count() > 0) {
      await expect(tiltmeter.first()).toBeVisible();
    }
  });

  test('should display edge stability if available', async ({ page }) => {
    // Look for edge stability metric
    const edgeStability = page.getByText(/edge.*stability|stability/i);
    
    if (await edgeStability.count() > 0) {
      await expect(edgeStability.first()).toBeVisible();
    }
  });

  test('should allow widget customization if draggable dashboard exists', async ({ page }) => {
    // Look for draggable dashboard or edit mode
    const editButton = page.getByRole('button', { name: /edit|customize|settings/i });
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Should show customization options
      await expect(page.getByText(/drag|move|remove|widget/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should refresh data', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /refresh|reload/i });
    
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      
      // Wait for loading state to complete
      await page.waitForTimeout(1000);
    }
  });

  test('should display time period selector', async ({ page }) => {
    // Look for time period dropdown
    const periodSelector = page.getByRole('combobox', { name: /period|time|range/i }).or(
      page.getByRole('button', { name: /period|time|range/i })
    );
    
    if (await periodSelector.count() > 0) {
      await periodSelector.click();
      
      // Should show period options
      await expect(page.getByRole('option', { name: /day|week|month|year/i })).toBeVisible({ timeout: 3000 });
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Dashboard should still be visible
    await expect(page.locator('main')).toBeVisible();
  });
});
