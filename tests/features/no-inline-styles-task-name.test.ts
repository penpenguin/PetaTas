import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Task name uses utility classes (no inline styles)', () => {
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

    // matchMedia stub to prefer dark (theme init path)
    const mql = {
      matches: true,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList
    // @ts-expect-error stub
    window.matchMedia = vi.fn().mockReturnValue(mql)

    // Minimal Chrome storage mocks returning a single TODO task
    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            {
              id: 't1',
              name: 'Sample Task',
              status: 'todo',
              notes: '',
              elapsedMs: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              additionalColumns: {}
            }
          ] }),
          set: vi.fn().mockResolvedValue(undefined),
        }
      }
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

  it('applies line-through via classes when marking done (no inline text-decoration)', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(checkbox).toBeTruthy()
    expect(checkbox.checked).toBe(false)

    // Toggle to done
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))

    const nameEl = document.querySelector('[data-testid="task-name"]') as HTMLElement
    expect(nameEl).toBeTruthy()
    // No inline style used
    expect(nameEl.getAttribute('style') || '').not.toMatch(/text-decoration|opacity/)
    // Uses utility class
    expect(nameEl.className).toMatch(/\bline-through\b/)
  })
})
