import { beforeEach, vi } from 'vitest';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
      getBytesInUse: vi.fn(),
    },
  },
  sidePanel: {
    open: vi.fn(),
    setOptions: vi.fn(),
  },
  runtime: {
    onConnect: {
      addListener: vi.fn(),
    },
    connect: vi.fn(),
    sendMessage: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
};

// Mock navigator.clipboard
const mockClipboard = {
  readText: vi.fn(),
  writeText: vi.fn(),
};

beforeEach(() => {
  // Setup global Chrome API mock
  (global as any).chrome = mockChrome;
  
  // Setup global navigator mock
  Object.defineProperty(global.navigator, 'clipboard', {
    value: mockClipboard,
    writable: true,
  });
  
  // Reset all mocks
  vi.clearAllMocks();
});