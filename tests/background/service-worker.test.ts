import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('service-worker integration', () => {
  let eventListeners: Record<string, (event: unknown) => void>;
  let actionListeners: Array<(tab: chrome.tabs.Tab) => Promise<void> | void>;
  let connectListeners: Array<(port: chrome.runtime.Port) => void>;
  let storageListeners: Array<(changes: Record<string, unknown>, namespace: string) => void>;
  let openSpy: ReturnType<typeof vi.fn>;
  let skipWaitingSpy: ReturnType<typeof vi.fn>;
  let claimSpy: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    eventListeners = {};
    actionListeners = [];
    connectListeners = [];
    storageListeners = [];
    skipWaitingSpy = vi.fn();
    claimSpy = vi.fn().mockResolvedValue(undefined);

    (globalThis as typeof globalThis & { self: ServiceWorkerGlobalScope }).self = {
      addEventListener: vi.fn((event: string, handler: (evt: unknown) => void) => {
        eventListeners[event] = handler;
      }),
      skipWaiting: skipWaitingSpy,
      clients: { claim: claimSpy },
    } as unknown as ServiceWorkerGlobalScope;

    openSpy = vi.fn().mockResolvedValue(undefined);

    (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome = {
      action: {
        onClicked: {
          addListener: (listener: (tab: chrome.tabs.Tab) => void) => {
            actionListeners.push(listener);
          },
        },
      },
      sidePanel: {
        open: openSpy,
      },
      runtime: {
        onConnect: {
          addListener: (listener: (port: chrome.runtime.Port) => void) => {
            connectListeners.push(listener);
          },
        },
      },
      storage: {
        onChanged: {
          addListener: (listener: (changes: Record<string, unknown>, namespace: string) => void) => {
            storageListeners.push(listener);
          },
        },
      },
    } as unknown as typeof chrome;

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('@/service-worker');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { self?: ServiceWorkerGlobalScope }).self;
    delete (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
  });

  it('opens side panel when toolbar icon clicked', async () => {
    const listener = actionListeners[0];
    expect(listener).toBeDefined();
    await listener?.({ id: 123 } as chrome.tabs.Tab);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenLastCalledWith({ tabId: 123 });
  });

  it('ignores toolbar clicks that lack a tab id', async () => {
    const listener = actionListeners[0];
    expect(listener).toBeDefined();
    await listener?.({} as chrome.tabs.Tab);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('installs and keeps the worker waiting', () => {
    const installHandler = eventListeners.install;
    expect(installHandler).toBeDefined();
    installHandler?.({} as Event);
    expect(skipWaitingSpy).toHaveBeenCalledTimes(1);
  });

  it('activates and claims open clients', async () => {
    const activateHandler = eventListeners.activate;
    expect(activateHandler).toBeDefined();
    const waitUntil = vi.fn();
    activateHandler?.({ waitUntil } as unknown as ExtendableEvent);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const [activationPromise] = waitUntil.mock.calls[0];
    expect(activationPromise).toBeInstanceOf(Promise);
    await activationPromise;
    expect(claimSpy).toHaveBeenCalledTimes(1);
  });

  it('responds to ping messages from the panel port', () => {
    const connectListener = connectListeners[0];
    expect(connectListener).toBeDefined();

    const messageListeners: Array<(message: { type: string; taskId?: string }) => void> = [];
    const disconnectListeners: Array<() => void> = [];
    const postMessage = vi.fn();

    connectListener?.({
      name: 'panel',
      postMessage,
      onMessage: { addListener: (cb: (message: { type: string }) => void) => messageListeners.push(cb) },
      onDisconnect: { addListener: (cb: () => void) => disconnectListeners.push(cb) },
    } as unknown as chrome.runtime.Port);

    expect(messageListeners).toHaveLength(1);
    messageListeners[0]?.({ type: 'PING' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'PONG' });
  });

  it('logs timer updates, unknown messages, and disconnects', () => {
    const connectListener = connectListeners[0];
    expect(connectListener).toBeDefined();

    const messageListeners: Array<(message: { type: string; taskId?: string }) => void> = [];
    const disconnectListeners: Array<() => void> = [];

    connectListener?.({
      name: 'panel',
      postMessage: vi.fn(),
      onMessage: { addListener: (cb: (message: { type: string; taskId?: string }) => void) => messageListeners.push(cb) },
      onDisconnect: { addListener: (cb: () => void) => disconnectListeners.push(cb) },
    } as unknown as chrome.runtime.Port);

    messageListeners[0]?.({ type: 'TIMER_START', taskId: 'task-1' });
    messageListeners[0]?.({ type: 'TIMER_STOP', taskId: 'task-1' });
    messageListeners[0]?.({ type: 'WHAT' });
    disconnectListeners[0]?.();

    expect(logSpy).toHaveBeenCalledWith('Side panel connected');
    expect(logSpy).toHaveBeenCalledWith('Timer started for task:', 'task-1');
    expect(logSpy).toHaveBeenCalledWith('Timer stopped for task:', 'task-1');
    expect(logSpy).toHaveBeenCalledWith('Unknown message type:', 'WHAT');
    expect(logSpy).toHaveBeenCalledWith('Side panel disconnected');
  });

  it('logs storage changes for debugging', () => {
    const storageListener = storageListeners[0];
    expect(storageListener).toBeDefined();
    storageListener?.({ tasks: { newValue: 1 } }, 'sync');
    expect(logSpy).toHaveBeenCalledWith('Storage changed:', 'sync', { tasks: { newValue: 1 } });
  });

  it('ignores ports that are not the side panel', () => {
    const connectListener = connectListeners[0];
    expect(connectListener).toBeDefined();

    connectListener?.({
      name: 'popup',
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
    } as unknown as chrome.runtime.Port);

    expect(logSpy).not.toHaveBeenCalled();
  });
});
