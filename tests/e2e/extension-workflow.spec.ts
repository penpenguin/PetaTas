import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import { join } from 'path';

// Helper function to get extension URL
function getExtensionUrl(extensionId: string, path: string = 'panel.html') {
  return `chrome-extension://${extensionId}/${path}`;
}

// Helper function to setup extension context
async function setupExtensionContext() {
  const extensionPath = join(__dirname, '../../dist');
  
  const browser = await chromium.launch({
    headless: false, // Extensions require non-headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--load-extension=${extensionPath}`,
      `--disable-extensions-except=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const context = await browser.newContext({
    permissions: ['clipboardRead', 'clipboardWrite'],
  });

  // Get extension ID by examining loaded extensions
  const backgroundPage = await context.waitForEvent('page', {
    predicate: page => page.url().startsWith('chrome-extension://'),
    timeout: 10000,
  });

  const extensionId = new URL(backgroundPage.url()).hostname;
  
  return { browser, context, extensionId };
}

test.describe('PetaTas Chrome Extension E2E Tests', () => {
  let context: BrowserContext;
  let extensionId: string;
  let panelPage: Page;

  test.beforeAll(async () => {
    const setup = await setupExtensionContext();
    context = setup.context;
    extensionId = setup.extensionId;
  });

  test.beforeEach(async () => {
    // Open the extension side panel
    panelPage = await context.newPage();
    await panelPage.goto(getExtensionUrl(extensionId));
    
    // Wait for the panel to load
    await panelPage.waitForLoadState('domcontentloaded');
    await panelPage.waitForTimeout(1000); // Allow for initialization
  });

  test.afterEach(async () => {
    await panelPage?.close();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.describe('Extension Loading and Initialization', () => {
    test('should load extension panel successfully', async () => {
      // Verify panel page loaded
      expect(panelPage.url()).toContain('chrome-extension://');
      expect(panelPage.url()).toContain('panel.html');

      // Verify essential elements are present
      await expect(panelPage.locator('#paste-button')).toBeVisible();
      await expect(panelPage.locator('#export-button')).toBeVisible();
      await expect(panelPage.locator('#empty-state')).toBeVisible();
    });

    test('should show empty state when no tasks exist', async () => {
      // Clear any existing storage
      await panelPage.evaluate(() => {
        return chrome.storage.sync.clear();
      });
      
      await panelPage.reload();
      await panelPage.waitForLoadState('domcontentloaded');

      // Verify empty state is shown
      await expect(panelPage.locator('#empty-state')).toBeVisible();
      await expect(panelPage.locator('#task-list')).not.toBeVisible();
      
      const emptyStateText = await panelPage.locator('#empty-state').textContent();
      expect(emptyStateText).toContain('No tasks yet');
    });
  });

  test.describe('Markdown Table Import Workflow', () => {
    test('Given a user has markdown table in clipboard, When they click paste, Then tasks should be imported', async () => {
      const markdownTable = `| Name | Status | Notes |
|------|--------|-------|
| Setup development environment | todo | Install Node.js and dependencies |
| Write unit tests | in-progress | Focus on core utilities |
| Deploy to production | done | Complete deployment checklist |`;

      // Setup clipboard with markdown table
      await panelPage.evaluate((markdown) => {
        return navigator.clipboard.writeText(markdown);
      }, markdownTable);

      // Click paste button
      await panelPage.click('#paste-button');

      // Wait for import to complete
      await panelPage.waitForTimeout(1000);

      // Verify tasks were imported
      await expect(panelPage.locator('#empty-state')).not.toBeVisible();
      await expect(panelPage.locator('#task-list')).toBeVisible();

      // Verify individual tasks
      const taskRows = panelPage.locator('.list-row');
      await expect(taskRows).toHaveCount(3);

      // Check first task
      const firstTask = taskRows.nth(0);
      await expect(firstTask.locator('.task-name')).toContainText('Setup development environment');
      await expect(firstTask.locator('.checkbox')).not.toBeChecked();

      // Check second task (in-progress should become todo)
      const secondTask = taskRows.nth(1);
      await expect(secondTask.locator('.task-name')).toContainText('Write unit tests');

      // Check third task (done should be checked)
      const thirdTask = taskRows.nth(2);
      await expect(thirdTask.locator('.task-name')).toContainText('Deploy to production');
      await expect(thirdTask.locator('.checkbox')).toBeChecked();

      // Verify success toast
      await expect(panelPage.locator('.alert-success')).toContainText('Imported 3 tasks');
    });

    test('Given invalid markdown in clipboard, When user clicks paste, Then error should be shown', async () => {
      const invalidMarkdown = 'This is just plain text, not a table';

      await panelPage.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, invalidMarkdown);

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(500);

      // Verify error toast
      await expect(panelPage.locator('.alert-error')).toContainText('Invalid Markdown table format');
      
      // Verify empty state still shown
      await expect(panelPage.locator('#empty-state')).toBeVisible();
    });

    test('Given empty clipboard, When user clicks paste, Then warning should be shown', async () => {
      await panelPage.evaluate(() => {
        return navigator.clipboard.writeText('');
      });

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(500);

      // Verify warning toast
      await expect(panelPage.locator('.alert-warning')).toContainText('Clipboard is empty');
    });
  });

  test.describe('Task Management Workflow', () => {
    test.beforeEach(async () => {
      // Import test tasks
      const testTable = `| Name | Status | Notes |
|------|--------|-------|
| Test Task 1 | todo | Test notes 1 |
| Test Task 2 | todo | Test notes 2 |`;

      await panelPage.evaluate((markdown) => {
        return navigator.clipboard.writeText(markdown);
      }, testTable);

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(1000);
    });

    test('Given tasks exist, When user toggles task completion, Then task status should update', async () => {
      const firstTask = panelPage.locator('.list-row').nth(0);
      const checkbox = firstTask.locator('.checkbox');

      // Initially should not be checked
      await expect(checkbox).not.toBeChecked();

      // Click checkbox to mark as done
      await checkbox.check();
      await panelPage.waitForTimeout(500);

      // Verify checkbox is now checked
      await expect(checkbox).toBeChecked();

      // Uncheck to mark as todo again
      await checkbox.uncheck();
      await panelPage.waitForTimeout(500);

      // Verify checkbox is unchecked
      await expect(checkbox).not.toBeChecked();
    });

    test('Given tasks exist, When user deletes a task, Then task should be removed', async () => {
      // Initially should have 2 tasks
      await expect(panelPage.locator('.list-row')).toHaveCount(2);

      // Click delete button on first task
      const firstTask = panelPage.locator('.list-row').nth(0);
      const deleteButton = firstTask.locator('button[data-action="delete"]');
      await deleteButton.click();

      await panelPage.waitForTimeout(500);

      // Should now have 1 task
      await expect(panelPage.locator('.list-row')).toHaveCount(1);

      // Verify success toast
      await expect(panelPage.locator('.alert-success')).toContainText('Task deleted');
    });
  });

  test.describe('Timer Functionality Workflow', () => {
    test.beforeEach(async () => {
      // Import a test task
      const testTable = `| Name | Status | Notes |
|------|--------|-------|
| Timer Test Task | todo | Test timer functionality |`;

      await panelPage.evaluate((markdown) => {
        return navigator.clipboard.writeText(markdown);
      }, testTable);

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(1000);
    });

    test('Given a task exists, When user starts timer, Then timer should run and display time', async () => {
      const taskRow = panelPage.locator('.list-row').nth(0);
      const timerButton = taskRow.locator('button[data-action="timer"]');
      const timerDisplay = taskRow.locator('.timer-display');

      // Initially should show 00:00:00 and play button
      await expect(timerDisplay).toContainText('00:00:00');
      await expect(timerButton).toContainText('▶️');

      // Start timer
      await timerButton.click();
      await panelPage.waitForTimeout(100);

      // Button should change to pause button
      await expect(timerButton).toContainText('⏸️');

      // Wait a bit and check timer is updating
      await panelPage.waitForTimeout(2000);
      
      const timerText = await timerDisplay.textContent();
      expect(timerText).not.toBe('00:00:00');
      expect(timerText).toMatch(/00:00:0[12]/); // Should show 1 or 2 seconds

      // Stop timer
      await timerButton.click();
      await panelPage.waitForTimeout(100);

      // Button should change back to play button
      await expect(timerButton).toContainText('▶️');
    });

    test('Given timer is running, When page is refreshed, Then timer state should persist', async () => {
      const taskRow = panelPage.locator('.list-row').nth(0);
      const timerButton = taskRow.locator('button[data-action="timer"]');

      // Start timer
      await timerButton.click();
      await panelPage.waitForTimeout(1000);

      // Refresh page
      await panelPage.reload();
      await panelPage.waitForLoadState('domcontentloaded');
      await panelPage.waitForTimeout(1000);

      // Timer should still be running
      const refreshedTaskRow = panelPage.locator('.list-row').nth(0);
      const refreshedTimerButton = refreshedTaskRow.locator('button[data-action="timer"]');
      
      await expect(refreshedTimerButton).toContainText('⏸️');
      
      // Timer display should show elapsed time
      const timerDisplay = refreshedTaskRow.locator('.timer-display');
      const timerText = await timerDisplay.textContent();
      expect(timerText).not.toBe('00:00:00');
    });
  });

  test.describe('Export Functionality Workflow', () => {
    test.beforeEach(async () => {
      // Import test tasks with varied statuses
      const testTable = `| Name | Status | Notes |
|------|--------|-------|
| Completed Task | done | This task is finished |
| Active Task | todo | This task is pending |
| Another Task | todo | Additional notes here |`;

      await panelPage.evaluate((markdown) => {
        return navigator.clipboard.writeText(markdown);
      }, testTable);

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(1000);
    });

    test('Given tasks exist, When user clicks export, Then markdown table should be copied to clipboard', async () => {
      // Click export button
      await panelPage.click('#export-button');
      await panelPage.waitForTimeout(500);

      // Verify success toast
      await expect(panelPage.locator('.alert-success')).toContainText('Copied 3 tasks to clipboard');

      // Verify clipboard content
      const clipboardContent = await panelPage.evaluate(() => {
        return navigator.clipboard.readText();
      });

      expect(clipboardContent).toContain('| Name | Status | Notes |');
      expect(clipboardContent).toContain('| Completed Task | done | This task is finished |');
      expect(clipboardContent).toContain('| Active Task | todo | This task is pending |');
      expect(clipboardContent).toContain('| Another Task | todo | Additional notes here |');
    });

    test('Given no tasks exist, When user clicks export, Then warning should be shown', async () => {
      // Clear all tasks first
      const deleteButtons = panelPage.locator('button[data-action="delete"]');
      const taskCount = await deleteButtons.count();
      
      for (let i = 0; i < taskCount; i++) {
        await deleteButtons.nth(0).click();
        await panelPage.waitForTimeout(300);
      }

      // Click export button
      await panelPage.click('#export-button');
      await panelPage.waitForTimeout(500);

      // Verify warning toast
      await expect(panelPage.locator('.alert-warning')).toContainText('No tasks to export');
    });
  });

  test.describe('Data Persistence Workflow', () => {
    test('Given tasks are imported, When extension is restarted, Then tasks should persist', async () => {
      // Import test tasks
      const testTable = `| Name | Status | Notes |
|------|--------|-------|
| Persistent Task 1 | todo | Should persist across sessions |
| Persistent Task 2 | done | Also should persist |`;

      await panelPage.evaluate((markdown) => {
        return navigator.clipboard.writeText(markdown);
      }, testTable);

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(1000);

      // Verify tasks are loaded
      await expect(panelPage.locator('.list-row')).toHaveCount(2);

      // Close and reopen the panel
      await panelPage.close();
      
      panelPage = await context.newPage();
      await panelPage.goto(getExtensionUrl(extensionId));
      await panelPage.waitForLoadState('domcontentloaded');
      await panelPage.waitForTimeout(1000);

      // Verify tasks are still there
      await expect(panelPage.locator('.list-row')).toHaveCount(2);
      await expect(panelPage.locator('.task-name').nth(0)).toContainText('Persistent Task 1');
      await expect(panelPage.locator('.task-name').nth(1)).toContainText('Persistent Task 2');

      // Verify task states are preserved
      await expect(panelPage.locator('.checkbox').nth(0)).not.toBeChecked();
      await expect(panelPage.locator('.checkbox').nth(1)).toBeChecked();
    });

    test('Given task has timer running, When extension is restarted, Then timer should continue from correct time', async () => {
      // Import a task
      const testTable = `| Name | Status | Notes |
|------|--------|-------|
| Timer Persistence Test | todo | Timer should persist |`;

      await panelPage.evaluate((markdown) => {
        return navigator.clipboard.writeText(markdown);
      }, testTable);

      await panelPage.click('#paste-button');
      await panelPage.waitForTimeout(1000);

      // Start timer and let it run for a bit
      const timerButton = panelPage.locator('button[data-action="timer"]').nth(0);
      await timerButton.click();
      await panelPage.waitForTimeout(3000); // Let timer run for 3 seconds

      // Close and reopen panel
      await panelPage.close();
      
      panelPage = await context.newPage();
      await panelPage.goto(getExtensionUrl(extensionId));
      await panelPage.waitForLoadState('domcontentloaded');
      await panelPage.waitForTimeout(2000); // Allow time for timer restoration

      // Verify timer is still running
      const restoredTimerButton = panelPage.locator('button[data-action="timer"]').nth(0);
      await expect(restoredTimerButton).toContainText('⏸️');

      // Verify timer shows accumulated time (should be around 3+ seconds)
      const timerDisplay = panelPage.locator('.timer-display').nth(0);
      const timerText = await timerDisplay.textContent();
      expect(timerText).not.toBe('00:00:00');
      expect(timerText).toMatch(/00:00:0[3-9]/); // Should show 3+ seconds
    });
  });
});