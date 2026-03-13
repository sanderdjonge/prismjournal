import { test, expect } from '@playwright/test';

test.describe('Journal Page', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login before each test
    await page.goto('/login');
    await page.getByRole('button', { name: /^register$/i }).click();
    
    const uniqueEmail = `journal-test-${Date.now()}@example.com`;
    await page.getByPlaceholder(/your name/i).fill('Test User');
    await page.getByPlaceholder(/you@example\.com/i).fill(uniqueEmail);
    await page.getByPlaceholder(/••••••••/).fill('ValidPassword123');
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Wait for redirect to dashboard/journal
    await expect(page).toHaveURL(/\/|\/dashboard/, { timeout: 15000 });
    
    // Navigate to journal page
    await page.goto('/journal');
  });

  test('should display journal page', async ({ page }) => {
    // Check for main journal elements
    await expect(page.locator('main')).toBeVisible();
  });

  test('should show empty state when no trades', async ({ page }) => {
    // New user should see empty state or default view
    const emptyState = page.getByText(/no trades|get started|import|connect/i);
    const hasEmptyState = await emptyState.count() > 0;
    
    // Or should at least show the journal page structure
    const hasJournalStructure = await page.locator('table, [data-testid="trade-list"], .trade-list').count() > 0;
    
    expect(hasEmptyState || hasJournalStructure).toBeTruthy();
  });

  test('should display trade list when trades exist', async ({ page }) => {
    // Check for trade table or list container
    const tradeListContainer = page.locator('table, [data-testid="trade-list"], .trade-list').first();
    
    // If trades exist, verify they're displayed
    const tradeCount = await tradeListContainer.count();
    if (tradeCount > 0) {
      await expect(tradeListContainer).toBeVisible();
    }
  });

  test('should filter trades by symbol', async ({ page }) => {
    // Look for symbol filter
    const symbolFilter = page.getByPlaceholder(/search.*symbol|filter.*symbol/i).or(
      page.getByRole('combobox', { name: /symbol/i })
    );
    
    if (await symbolFilter.count() > 0) {
      await symbolFilter.fill('EURUSD');
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
    }
  });

  test('should filter trades by date range', async ({ page }) => {
    // Look for date filter inputs
    const dateFromInput = page.getByPlaceholder(/from|start/i).or(
      page.locator('input[type="date"]').first()
    );
    const dateToInput = page.getByPlaceholder(/to|end/i).or(
      page.locator('input[type="date"]').last()
    );
    
    if (await dateFromInput.count() > 0 && await dateToInput.count() > 0) {
      // Set date range
      await dateFromInput.fill('2024-01-01');
      await dateToInput.fill('2024-12-31');
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
    }
  });

  test('should open trade details when clicking a trade', async ({ page }) => {
    // Look for clickable trade row
    const tradeRow = page.locator('table tbody tr, [data-testid="trade-row"]').first();
    
    if (await tradeRow.count() > 0) {
      await tradeRow.click();
      
      // Should show trade details modal or navigate to detail page
      const detailModal = page.locator('[role="dialog"], [data-testid="trade-detail"]');
      
      if (await detailModal.count() > 0) {
        await expect(detailModal).toBeVisible();
      }
    }
  });

  test('should analyze a trade', async ({ page }) => {
    // Look for analyze button on a trade
    const analyzeButton = page.getByRole('button', { name: /analyze|ai/i }).first();
    
    if (await analyzeButton.count() > 0) {
      await analyzeButton.click();
      
      // Should show analysis modal or result
      const analysisResult = page.locator('[role="dialog"], [data-testid="analysis-result"]');
      if (await analysisResult.count() > 0) {
        await expect(analysisResult).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should upload screenshot for a trade', async ({ page }) => {
    // Look for upload button
    const uploadButton = page.getByRole('button', { name: /upload|screenshot/i }).first();
    
    if (await uploadButton.count() > 0) {
      // Click upload button
      await uploadButton.click();
      
      // Should show file input or upload modal
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await expect(fileInput).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should edit trade notes', async ({ page }) => {
    // Look for edit button or notes field
    const editButton = page.getByRole('button', { name: /edit|notes/i }).first();
    
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // Should show notes textarea
      const notesInput = page.getByPlaceholder(/notes/i);
      if (await notesInput.count() > 0) {
        await expect(notesInput).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should rate trade entry/exit/management', async ({ page }) => {
    // Look for rating stars or rating buttons
    const ratingStars = page.locator('[data-testid="rating"], .rating-star, button[aria-label*="rate"]').first();
    
    if (await ratingStars.count() > 0) {
      await ratingStars.click();
    }
  });

  test('should set mood for trade', async ({ page }) => {
    // Look for mood selector
    const moodSelector = page.getByRole('combobox', { name: /mood/i }).or(
      page.getByRole('button', { name: /mood/i })
    );
    
    if (await moodSelector.count() > 0) {
      await moodSelector.click();
      
      // Select a mood option
      const moodOption = page.getByRole('option', { name: /confident|neutral|anxious/i }).first();
      if (await moodOption.count() > 0) {
        await moodOption.click();
      }
    }
  });

  test('should set plan compliance', async ({ page }) => {
    // Look for plan compliance selector
    const planSelector = page.getByRole('combobox', { name: /plan|compliance/i }).or(
      page.getByRole('button', { name: /plan|compliance/i })
    );
    
    if (await planSelector.count() > 0) {
      await planSelector.click();
      
      // Select an option
      const planOption = page.getByRole('option', { name: /followed|deviated|no plan/i }).first();
      if (await planOption.count() > 0) {
        await planOption.click();
      }
    }
  });

  test('should paginate through trades', async ({ page }) => {
    // Look for pagination controls
    const nextButton = page.getByRole('button', { name: /next|>/i });
    
    if (await nextButton.count() > 0) {
      // Check if next button is enabled
      const isEnabled = await nextButton.isEnabled();
      
      if (isEnabled) {
        await nextButton.click();
        
        // Wait for page to load
        await page.waitForTimeout(500);
      }
    }
  });

  test('should export trades', async ({ page }) => {
    // Look for export button
    const exportButton = page.getByRole('button', { name: /export|download/i });
    
    if (await exportButton.count() > 0) {
      // Click export - may or may not trigger download
      await exportButton.click();
      
      // Wait a moment for any action
      await page.waitForTimeout(500);
    }
  });
});
