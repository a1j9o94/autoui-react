import { test, expect, Page } from '@playwright/test';

/**
 * E2E test to debug the rendering pipeline issue where:
 * "Router shows generating views but browser doesn't update"
 *
 * This test captures screenshots and console logs at each stage of the pipeline:
 * 1. Initial load
 * 2. After router resolves (AI_RESPONSE or PARTIAL_UPDATE)
 * 3. After binding resolution
 * 4. After render attempt
 * 5. After user interaction (click)
 */

interface PipelineState {
  uiStatus: string;
  hasLayout: boolean;
  hasRenderedNode: boolean;
  isResolvingBindings: boolean;
  isLoading: boolean;
  layoutId: string | null;
  dataContextKeys: string[];
  lastEvent: string | null;
  timestamp: number;
}

test.describe('AutoUI Rendering Pipeline Debug', () => {
  let consoleLogs: string[] = [];
  let pipelineStates: PipelineState[] = [];

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    pipelineStates = [];

    // Capture all console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);

      // Look for pipeline state updates
      if (text.includes('[PIPELINE_STATE]')) {
        try {
          const stateJson = text.replace('[PIPELINE_STATE]', '').trim();
          const state = JSON.parse(stateJson);
          pipelineStates.push(state);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
  });

  test('should capture initial rendering pipeline', async ({ page }) => {
    // Using real Anthropic Claude Haiku 4.5 for LLM calls
    // Mock planner disabled to test real LLM integration

    // Navigate and wait for initial load
    await page.goto('/');

    // Screenshot: Initial page load
    await page.screenshot({
      path: 'e2e-results/01-initial-load.png',
      fullPage: true
    });

    // Wait for the AutoUI component to appear
    await page.waitForSelector('.autoui-root', { timeout: 10000 });

    // Screenshot: AutoUI root mounted
    await page.screenshot({
      path: 'e2e-results/02-autoui-mounted.png',
      fullPage: true
    });

    // Check the current status displayed
    const statusText = await page.locator('.autoui-root > div:first-child').textContent();
    console.log('Initial status:', statusText);

    // Wait for status to change from initializing
    await page.waitForFunction(() => {
      const statusEl = document.querySelector('.autoui-root > div:first-child');
      return statusEl && !statusEl.textContent?.includes('initializing');
    }, { timeout: 30000 });

    // Screenshot: After initialization
    await page.screenshot({
      path: 'e2e-results/03-after-initialization.png',
      fullPage: true
    });

    // Check if content is visible
    const contentVisible = await page.locator('.autoui-content').isVisible().catch(() => false);
    console.log('Content visible after init:', contentVisible);

    // Wait for idle status (content should render)
    try {
      await page.waitForFunction(() => {
        const statusEl = document.querySelector('.autoui-root > div:first-child');
        return statusEl && statusEl.textContent?.includes('idle');
      }, { timeout: 30000 });

      // Screenshot: Idle state
      await page.screenshot({
        path: 'e2e-results/04-idle-state.png',
        fullPage: true
      });
    } catch (e) {
      console.log('Timeout waiting for idle state');
      await page.screenshot({
        path: 'e2e-results/04-timeout-not-idle.png',
        fullPage: true
      });
    }

    // Check for content
    const hasContent = await page.locator('.autoui-content').isVisible().catch(() => false);
    console.log('Has content:', hasContent);

    // Screenshot: Final state
    await page.screenshot({
      path: 'e2e-results/05-final-state.png',
      fullPage: true
    });

    // Log all captured console messages
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    // Log pipeline states
    console.log('\n=== Pipeline States ===');
    pipelineStates.forEach((state, i) => {
      console.log(`State ${i + 1}:`, JSON.stringify(state, null, 2));
    });

    // Write logs to file for analysis
    const fs = require('fs');
    fs.writeFileSync(
      'e2e-results/console-logs.json',
      JSON.stringify({ consoleLogs, pipelineStates }, null, 2)
    );
  });

  test('should capture state after user interaction', async ({ page }) => {
    // Enable mock planner to avoid API quota issues
    await page.addInitScript(() => {
      (window as any).__USE_MOCK_PLANNER = true;
    });

    await page.goto('/');

    // Wait for initial render
    await page.waitForSelector('.autoui-root', { timeout: 10000 });

    // Wait for content to be visible (or timeout)
    try {
      await page.waitForSelector('.autoui-content', { timeout: 30000 });
    } catch (e) {
      console.log('Content never became visible during initial load');
      await page.screenshot({
        path: 'e2e-results/interaction-01-no-initial-content.png',
        fullPage: true
      });

      // Still continue to see what state we're in
      const statusText = await page.locator('.autoui-root > div:first-child').textContent();
      console.log('Status when content not visible:', statusText);
      return;
    }

    // Screenshot: Before interaction
    await page.screenshot({
      path: 'e2e-results/interaction-01-before-click.png',
      fullPage: true
    });

    // Look for any clickable button
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log('Found buttons:', buttonCount);

    if (buttonCount > 0) {
      // Click the first button that looks like "View Details"
      const viewDetailsBtn = page.locator('button:has-text("View"), button:has-text("Details")').first();
      const hasViewDetails = await viewDetailsBtn.isVisible().catch(() => false);

      if (hasViewDetails) {
        await viewDetailsBtn.click();
        console.log('Clicked view details button');
      } else {
        // Click first available button
        await buttons.first().click();
        console.log('Clicked first button');
      }

      // Wait a bit for state changes
      await page.waitForTimeout(2000);

      // Screenshot: After click
      await page.screenshot({
        path: 'e2e-results/interaction-02-after-click.png',
        fullPage: true
      });

      // Check status
      const statusAfterClick = await page.locator('.autoui-root > div:first-child').textContent();
      console.log('Status after click:', statusAfterClick);

      // Wait for idle again
      try {
        await page.waitForFunction(() => {
          const statusEl = document.querySelector('.autoui-root > div:first-child');
          return statusEl && statusEl.textContent?.includes('idle');
        }, { timeout: 15000 });

        await page.screenshot({
          path: 'e2e-results/interaction-03-idle-after-click.png',
          fullPage: true
        });
      } catch (e) {
        console.log('Never reached idle after click');
        await page.screenshot({
          path: 'e2e-results/interaction-03-stuck-after-click.png',
          fullPage: true
        });
      }
    }

    // Final state
    await page.screenshot({
      path: 'e2e-results/interaction-final.png',
      fullPage: true
    });

    console.log('\n=== Console Logs (Interaction Test) ===');
    consoleLogs.slice(-50).forEach(log => console.log(log));
  });

  test('should monitor pipeline state transitions', async ({ page }) => {
    // Enable mock planner and inject a script to monitor state changes
    await page.addInitScript(() => {
      (window as any).__USE_MOCK_PLANNER = true;
      (window as any).__pipelineStates = [];
      (window as any).__captureState = (label: string, state: any) => {
        const entry = {
          label,
          timestamp: Date.now(),
          ...state
        };
        (window as any).__pipelineStates.push(entry);
        console.log('[PIPELINE_STATE]', JSON.stringify(entry));
      };
    });

    await page.goto('/');

    // Wait for component to mount
    await page.waitForSelector('.autoui-root', { timeout: 10000 });

    // Wait for some time to capture state transitions
    await page.waitForTimeout(10000);

    // Get all captured states
    const states = await page.evaluate(() => (window as any).__pipelineStates || []);

    console.log('\n=== Pipeline State Transitions ===');
    states.forEach((state: any, i: number) => {
      console.log(`\n--- Transition ${i + 1}: ${state.label} ---`);
      console.log(JSON.stringify(state, null, 2));
    });

    // Screenshot timeline
    await page.screenshot({
      path: 'e2e-results/pipeline-final-state.png',
      fullPage: true
    });

    // Analyze the transitions
    const statusTransitions = states.map((s: any) => s.uiStatus).filter(Boolean);
    console.log('\nStatus transitions:', statusTransitions);

    // Check if we ever got stuck
    const lastStatus = statusTransitions[statusTransitions.length - 1];
    console.log('Final status:', lastStatus);
  });
});
