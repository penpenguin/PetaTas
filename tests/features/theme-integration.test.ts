import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Theme integration via panel-client', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html data-theme="petatas-light"><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    const mql = {
      matches: true, // dark mode
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList
    // @ts-expect-error stub
    window.matchMedia = vi.fn().mockReturnValue(mql)

    // Minimal Chrome storage mocks
    const mockChrome = {
      storage: { sync: { get: vi.fn().mockResolvedValue({ tasks: [] }), set: vi.fn().mockResolvedValue(undefined) } },
    }
    // @ts-expect-error test env
    global.chrome = mockChrome

    // Clipboard stub
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn(), writeText: vi.fn() },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('sets abyss theme on load when system prefers dark', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')
    expect(document.documentElement.getAttribute('data-theme')).toBe('abyss')
  })
})
