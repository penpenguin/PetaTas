import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Detail badges truncate text and show tooltip', () => {
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

    const longValue = 'とても長い値でバッジの幅を超えてしまう可能性があります_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'

    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            { id: 't1', name: 'テスト', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: { '優先': 'high', 'ラベル': longValue } }
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

  it('renders detail badges with ellipsis and a daisyUI tooltip', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const row = document.querySelector('.list-row') as HTMLElement
    expect(row).toBeTruthy()

    // Collect badges that are not the status badge
    const badges = Array.from(row.querySelectorAll('span.badge'))
      .filter((el) => !el.classList.contains('status-badge')) as HTMLElement[]
    expect(badges.length).toBeGreaterThan(0)

    for (const badge of badges) {
      // Should have daisyUI tooltip via data-tip and class
      expect(badge.classList.contains('tooltip')).toBe(true)
      const tip = badge.getAttribute('data-tip')
      expect(tip && tip.length).toBeGreaterThan(0)
      // Should use truncation utility via inner span
      const inner = badge.querySelector('span') as HTMLElement | null
      expect(inner).toBeTruthy()
      expect(inner!.className).toMatch(/\btruncate\b/)
    }
  })
})
