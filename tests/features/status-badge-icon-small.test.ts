import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Status badge shows only icon (tooltip for text)', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
    </body></html>`)

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

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

    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            { id: 'a', name: 'Todo', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} },
            { id: 'b', name: 'Doing', status: 'in-progress', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} },
            { id: 'c', name: 'Done', status: 'done', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} },
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

  it('renders only an SVG status icon and no visible text in each status badge', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const rows = Array.from(document.querySelectorAll('div[data-testid^="task-"][data-status]')) as HTMLElement[]
    expect(rows.length).toBe(3)

    rows.forEach((row) => {
      const status = row.getAttribute('data-status') as 'todo' | 'in-progress' | 'done'
      const badge = row.querySelector('.status-badge') as HTMLElement
      expect(badge).toBeTruthy()

      const icon = badge.querySelector('svg.status-icon') as SVGElement | null
      expect(icon).toBeTruthy()
      expect(icon?.getAttribute('data-icon')).toBe(status)
      // Icon-only badge: icon should not be hidden on md and up
      expect(icon?.getAttribute('class') || '').not.toMatch(/\bmd:hidden\b/)

      // Icon-only: no visible text node/span inside the badge
      const textSpan = badge.querySelector('span') as HTMLElement | null
      expect(textSpan).toBeNull()
      expect((badge.textContent || '').trim()).toBe('')
    })
  })
})
