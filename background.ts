// Background service worker for PetaTas Chrome extension

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Handle side panel behavior
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'panel') {
    port.onDisconnect.addListener(() => {
      // Panel closed - could handle cleanup here if needed
      console.log('Side panel disconnected');
    });
  }
});