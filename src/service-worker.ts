// Service Worker for PetaTas Chrome Extension
// Handles Side Panel API and background processing

// Install event
self.addEventListener('install', (_event) => {
  console.log('PetaTas Service Worker installed');
  // Skip waiting to activate immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('PetaTas Service Worker activated');
  // Claim all clients immediately
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (event as any).waitUntil((self as any).clients.claim());
});

// Action button click handler - opens side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Handle connections from side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'panel') {
    console.log('Side panel connected');
    
    port.onMessage.addListener((message) => {
      console.log('Message from panel:', message);
      
      // Handle different message types
      switch (message.type) {
        case 'PING':
          port.postMessage({ type: 'PONG' });
          break;
        case 'TIMER_START':
          // Timer started - could handle background timer logic here
          console.log('Timer started for task:', message.taskId);
          break;
        case 'TIMER_STOP':
          // Timer stopped
          console.log('Timer stopped for task:', message.taskId);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Side panel disconnected');
    });
  }
});

// Handle storage changes (for debugging)
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', namespace, changes);
});

// Keep service worker alive during active timer sessions
const activeTimers = new Set<string>();

// Function to update active timers
function updateActiveTimers(timerId: string, isActive: boolean) {
  if (isActive) {
    activeTimers.add(timerId);
  } else {
    activeTimers.delete(timerId);
  }
}

// Function is available for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _useUpdateActiveTimers() { updateActiveTimers('', false); }

// Note: Service workers run in global context, no exports needed