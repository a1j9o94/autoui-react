import { test, expect } from '@playwright/test';

/**
 * Multi-step scenario tests for AutoUI
 * Tests complex UIs with interactions
 */

test.describe('AutoUI Scenario Tests', () => {

  test('Mini CRM - Contacts and Meetings', async ({ page }) => {
    // Navigate to CRM scenario
    await page.goto('/test?scenario=crm');

    // Screenshot: Initial loading
    await page.screenshot({
      path: 'e2e-results/crm-01-loading.png',
      fullPage: true
    });

    // Wait for AutoUI to mount
    await page.waitForSelector('.autoui-root', { timeout: 10000 });

    // Wait for content to appear (status becomes idle)
    try {
      await page.waitForFunction(() => {
        const statusEl = document.querySelector('.autoui-root > div:first-child');
        return statusEl && statusEl.textContent?.includes('idle');
      }, { timeout: 60000 });
    } catch (e) {
      console.log('Timeout waiting for idle - continuing anyway');
    }

    // Screenshot: Initial CRM view
    await page.screenshot({
      path: 'e2e-results/crm-02-initial.png',
      fullPage: true
    });

    // Check for content
    const contentVisible = await page.locator('.autoui-content').isVisible().catch(() => false);
    console.log('CRM Content visible:', contentVisible);

    if (contentVisible) {
      // Look for contact list items
      const contactCards = page.locator('.autoui-content [data-id*="contact"], .autoui-content .autoui-card');
      const cardCount = await contactCards.count();
      console.log('Found contact cards:', cardCount);

      // Try to click on a View/Details button if available
      const viewButton = page.locator('button:has-text("View"), button:has-text("Details"), button:has-text("detail")').first();
      if (await viewButton.isVisible().catch(() => false)) {
        await viewButton.click();
        await page.waitForTimeout(2000);

        // Screenshot: After clicking detail
        await page.screenshot({
          path: 'e2e-results/crm-03-detail-view.png',
          fullPage: true
        });
      }

      // Look for any "Schedule" or "Add Meeting" button
      const scheduleButton = page.locator('button:has-text("Schedule"), button:has-text("Meeting"), button:has-text("Add")').first();
      if (await scheduleButton.isVisible().catch(() => false)) {
        await scheduleButton.click();
        await page.waitForTimeout(2000);

        // Screenshot: After clicking schedule
        await page.screenshot({
          path: 'e2e-results/crm-04-schedule.png',
          fullPage: true
        });
      }
    }

    // Final screenshot
    await page.screenshot({
      path: 'e2e-results/crm-05-final.png',
      fullPage: true
    });

    // Basic assertion - content should be visible
    expect(contentVisible).toBeTruthy();
  });

  test('Sales Dashboard - Team Performance', async ({ page }) => {
    // Navigate to Sales scenario
    await page.goto('/test?scenario=sales');

    // Screenshot: Initial loading
    await page.screenshot({
      path: 'e2e-results/sales-01-loading.png',
      fullPage: true
    });

    // Wait for AutoUI to mount
    await page.waitForSelector('.autoui-root', { timeout: 10000 });

    // Wait for content to appear
    try {
      await page.waitForFunction(() => {
        const statusEl = document.querySelector('.autoui-root > div:first-child');
        return statusEl && statusEl.textContent?.includes('idle');
      }, { timeout: 60000 });
    } catch (e) {
      console.log('Timeout waiting for idle - continuing anyway');
    }

    // Screenshot: Initial Sales Dashboard
    await page.screenshot({
      path: 'e2e-results/sales-02-initial.png',
      fullPage: true
    });

    // Check for content
    const contentVisible = await page.locator('.autoui-content').isVisible().catch(() => false);
    console.log('Sales Content visible:', contentVisible);

    if (contentVisible) {
      // Look for team member rows/cards
      const teamCards = page.locator('.autoui-content [data-id*="team"], .autoui-content .autoui-card');
      const cardCount = await teamCards.count();
      console.log('Found team cards:', cardCount);

      // Try to click on first team member to see their deals
      const viewButton = page.locator('button:has-text("View"), button:has-text("Details"), button:has-text("Deals")').first();
      if (await viewButton.isVisible().catch(() => false)) {
        await viewButton.click();
        await page.waitForTimeout(2000);

        // Screenshot: After clicking to see deals
        await page.screenshot({
          path: 'e2e-results/sales-03-deals-view.png',
          fullPage: true
        });
      }

      // Check if there's a way to view pipeline stages
      const pipelineButton = page.locator('button:has-text("Pipeline"), button:has-text("Stage")').first();
      if (await pipelineButton.isVisible().catch(() => false)) {
        await pipelineButton.click();
        await page.waitForTimeout(2000);

        // Screenshot: Pipeline view
        await page.screenshot({
          path: 'e2e-results/sales-04-pipeline.png',
          fullPage: true
        });
      }
    }

    // Final screenshot
    await page.screenshot({
      path: 'e2e-results/sales-05-final.png',
      fullPage: true
    });

    // Basic assertion
    expect(contentVisible).toBeTruthy();
  });
});
