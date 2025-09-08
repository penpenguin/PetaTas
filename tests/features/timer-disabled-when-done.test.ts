import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Timer controls disabled for done tasks', () => {
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

    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            { id: 'd1', name: 'Already Done', status: 'done', notes: '', elapsedMs: 60000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
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

  it('renders timer button disabled and blocks start action', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const btn = document.querySelector('button[data-action=\"timer\"][data-task-id=\"d1\"]') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-disabled')).toBe('true')

    const labelBefore = btn.getAttribute('aria-label')
    // Try clicking the button or its inner SVG
    btn.click()
    const svg = btn.querySelector('svg') as SVGElement
    svg?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    const labelAfter = btn.getAttribute('aria-label')
    expect(labelAfter).toBe(labelBefore)
  })
})

