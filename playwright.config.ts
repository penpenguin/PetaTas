import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-extension',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome-specific settings for extension testing
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            // Load extension for testing
            `--load-extension=${join(__dirname, 'dist')}`,
            // Disable extension signature checks for testing
            '--disable-extensions-except=${join(__dirname, 'dist')}',
            `--allowlisted-extension-id=${join(__dirname, 'dist')}`,
          ],
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run build',
    port: 0, // We don't need a port since it's an extension
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Global setup for extension testing */
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  
  /* Global teardown */
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
  
  /* Test timeout */
  timeout: 30 * 1000,
  
  /* Expect timeout */
  expect: {
    timeout: 5 * 1000,
  },
  
  /* Output directory for test results */
  outputDir: 'test-results/',
});