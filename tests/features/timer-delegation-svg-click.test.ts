import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Timer button click delegation works on nested SVG/path', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id=\"task-list\" class=\"list hidden\"></div>
      <div id=\"empty-state\"></div>
      <div id=\"toast-container\"></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

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

    const tasks = [
      { id: 't1', name: 'Timer Task', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
    ]
    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockImplementation(async (keys: any) => {
            const index = { version: 1, chunks: ['tasks_0'], total: tasks.length, updatedAt: 0 }
            if (keys === 'tasks_index') return { tasks_index: index }
            if (Array.isArray(keys)) {
              const out: Record<string, unknown> = {}
              for (const k of keys) if (k === 'tasks_0') out[k] = tasks
              return out
            }
            return {}
          }),
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

  it('clicking the SVG toggles timer (Start → Pause)', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const btn = document.querySelector('button[data-action=\"timer\"]') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toBe('Start timer')

    const svg = btn.querySelector('svg') as SVGElement
    expect(svg).toBeTruthy()
    svg.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    expect(btn.getAttribute('aria-label')).toBe('Pause timer')
  })

  it('clicking the inner path toggles timer (Pause → Start)', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const btn = document.querySelector('button[data-action=\"timer\"]') as HTMLButtonElement
    // Ensure it starts first
    btn.click()
    expect(btn.getAttribute('aria-label')).toBe('Pause timer')

    // Re-select inner path because icon DOM is replaced on toggle
    const svg2 = btn.querySelector('svg') as SVGElement
    const path2 = svg2.querySelector('path') as SVGPathElement
    expect(path2).toBeTruthy()

    // Now click the inner path to stop
    path2.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    expect(btn.getAttribute('aria-label')).toBe('Start timer')
  })
})
