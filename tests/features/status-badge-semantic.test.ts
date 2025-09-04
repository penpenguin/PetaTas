import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Status badge uses daisyUI semantics', () => {
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

  it('renders a .status-badge with daisyUI badge classes and no row bg/border overrides', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')
    // Allow async initialize/render to settle
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const rows = Array.from(document.querySelectorAll('div[data-testid^="task-"][data-status]')) as HTMLElement[]
    expect(rows.length).toBeGreaterThan(0)

    rows.forEach((row) => {
      const badge = row.querySelector('.status-badge') as HTMLElement
      expect(badge).toBeTruthy()
      expect(badge.className).toMatch(/\bbadge\b/)
      // Ensure row no longer relies on bg-warning/10 or border-l-* for status
      expect(row.className).not.toMatch(/\bborder-l-\d\b|bg-warning\/10|bg-success\/10|opacity-70/)

      const status = row.getAttribute('data-status')
      const expected = status === 'in-progress' ? 'IN PROGRESS' : status === 'done' ? 'DONE' : 'TODO'
      expect(badge.getAttribute('aria-label')).toBe(`Status: ${expected}`)
    })
  })
})
