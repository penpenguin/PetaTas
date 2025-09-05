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

  it('places status badge next to checkbox and colors left border by status', async () => {
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
      // Badge should be immediately next to the checkbox
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox).toBeTruthy()
      expect(checkbox.nextElementSibling).toBe(badge)
      // They should be visually inline (parent has flex)
      const parent = checkbox.parentElement as HTMLElement
      expect(parent.className).toMatch(/\bflex\b/)
      expect(parent.className).toMatch(/\bitems-center\b/)
      // No space distribution; use gap-based spacing
      expect(parent.className).not.toMatch(/\bjustify-(between|evenly|around)\b/)
      expect(parent.className).toMatch(/\bgap-3\b/)

      // Timer controls should be in the same header row, after the badge
      const timerControls = parent.querySelector('.timer-controls') as HTMLElement | null
      expect(timerControls).toBeTruthy()
      expect(badge.nextElementSibling).toBe(timerControls)
      // Timer section has a bit more left margin for visual separation
      expect((timerControls as HTMLElement).className).toMatch(/\bml-4\b/)

      // Card left border colors should reflect status (no background overlays)
      expect(row.className).toMatch(/\bborder-l-4\b/)

      const status = row.getAttribute('data-status')
      const expected = status === 'in-progress' ? 'IN PROGRESS' : status === 'done' ? 'DONE' : 'TODO'
      const expectedBorder = status === 'in-progress' ? 'border-warning' : status === 'done' ? 'border-success' : 'border-base-300'
      expect(row.className).toMatch(new RegExp(`\\b${expectedBorder}\\b`))
      // Still avoid bg overlays & opacity hacks
      expect(row.className).not.toMatch(/bg-warning\/10|bg-success\/10|opacity-70/)
      expect(badge.getAttribute('aria-label')).toBe(`Status: ${expected}`)
    })
  })
})
