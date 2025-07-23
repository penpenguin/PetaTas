import { chromium, FullConfig } from '@playwright/test';
import { join } from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up Chrome extension testing environment...');
  
  const extensionPath = join(__dirname, '../../dist');
  console.log(`📁 Extension path: ${extensionPath}`);
  
  // Launch Chrome with extension loaded
  const browser = await chromium.launch({
    headless: false, // Extension testing requires non-headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      `--load-extension=${extensionPath}`,
      `--disable-extensions-except=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
    ],
  });

  // Create a context and page to get extension ID
  const context = await browser.newContext({
    permissions: ['clipboardRead', 'clipboardWrite'],
  });
  
  const page = await context.newPage();
  
  // Navigate to extension management page to get extension ID
  await page.goto('chrome://extensions/');
  
  // Get the extension ID
  const extensionId = await page.evaluate(() => {
    const extensionCards = document.querySelectorAll('extensions-item');
    for (const card of extensionCards) {
      const name = card.shadowRoot?.querySelector('#name')?.textContent;
      if (name?.includes('PetaTas') || name?.includes('petatas')) {
        return card.getAttribute('id');
      }
    }
    return null;
  });

  if (extensionId) {
    console.log(`✅ Extension loaded with ID: ${extensionId}`);
    // Store extension ID for tests
    process.env.EXTENSION_ID = extensionId;
  } else {
    console.warn('⚠️  Could not determine extension ID. Tests may fail.');
  }

  await context.close();
  await browser.close();
  
  console.log('✅ Global setup completed');
}

export default globalSetup;