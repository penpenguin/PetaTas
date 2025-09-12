import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Error notifications render toasts', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
      <button id="paste-button"></button>
      <button id="export-button"></button>
      <button id="add-task-button"></button>
      <button id="clear-all-button"></button>
      <input type="checkbox" id="add-task-modal" class="modal-toggle" />
      <div class="modal"><div class="modal-box"><form id="add-task-form"><div id="dynamic-fields-container"></div></form></div></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    const mockChrome = { storage: { sync: { get: vi.fn().mockImplementation(async (keys: any) => {
      const index = { version: 1, chunks: ['tasks_0'], total: 0, updatedAt: 0 }
      if (keys === 'tasks_index') return { tasks_index: index }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {}
        for (const k of keys) if (k === 'tasks_0') out[k] = []
        return out
      }
      return {}
    }), set: vi.fn().mockResolvedValue(undefined) } } }
    // @ts-expect-error test env
    global.chrome = mockChrome

    Object.defineProperty(global.navigator, 'clipboard', { value: { readText: vi.fn(), writeText: vi.fn() }, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('shows a toast when error-notification is dispatched', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const evt = new dom.window.CustomEvent('error-notification', {
      detail: { message: 'Oops!', severity: 'high', timestamp: new Date() }
    })
    document.dispatchEvent(evt)

    const toast = document.querySelector('#toast-container .alert') as HTMLElement | null
    expect(toast).toBeTruthy()
    // severity: high → error → class alert-error
    expect(toast?.className).toMatch(/\balert-error\b/)
    expect(toast?.textContent).toContain('Oops!')
  })
})
