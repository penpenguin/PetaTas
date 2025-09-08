import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Notes area aligns with daisyUI form-control', () => {
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
            { id: 'n1', name: 'Task with notes', status: 'todo', notes: 'Hello', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
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

  it('wraps notes UI with .form-control and uses daisyUI-friendly utilities', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const container = document.querySelector('.notes-container') as HTMLElement
    expect(container).toBeTruthy()
    expect(container.className).toMatch(/\bform-control\b/)

    const textarea = document.querySelector('textarea.notes-input') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.className).toMatch(/\btextarea\b/)
    expect(textarea.className).toMatch(/\btextarea-bordered\b/)

    // No separate display block is required anymore
    const display = document.querySelector('.notes-display') as HTMLElement
    expect(display).toBeNull()
  })
})
