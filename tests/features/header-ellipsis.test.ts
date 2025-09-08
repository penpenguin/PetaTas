import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Header layout at 360px uses nowrap; status badge is icon-only', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    // Provide matchMedia stub for theme.js
    const mql = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList
    // @ts-expect-error stub
    window.matchMedia = vi.fn().mockReturnValue(mql)

    // Provide localStorage stub to avoid opaque origin issues
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true,
    })

    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            { id: 'x', name: 'X', status: 'in-progress', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
          ] }),
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    }
    // @ts-expect-error test env
    global.chrome = mockChrome
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('renders header with whitespace-nowrap and an icon-only status badge', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const row = document.querySelector('.list-row') as HTMLElement
    expect(row).toBeTruthy()

    const header = row.querySelector('div.flex.items-center') as HTMLElement
    expect(header).toBeTruthy()
    expect(header.className).toMatch(/\bwhitespace-nowrap\b/)

    const badge = row.querySelector('.status-badge') as HTMLElement
    expect(badge).toBeTruthy()
    // Icon-only: no fixed width and no inner text span
    expect(badge.className).toMatch(/\bbadge\b/)
    expect(badge.querySelector('svg.status-icon')).toBeTruthy()
    expect(badge.querySelector('span')).toBeNull()
  })
})
