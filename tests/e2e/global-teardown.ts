async function globalTeardown() {
  console.log('🧹 Cleaning up Chrome extension testing environment...');
  
  // Clean up any global resources if needed
  delete process.env.EXTENSION_ID;
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;