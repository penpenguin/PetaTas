import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import showToast from '../../src/utils/toast'

describe('Toast XSS hardening', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="toast-container"></div>
    </body></html>`)
    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    dom.window.close()
  })

  it('renders message as text, not HTML', () => {
    const payload = '<img src=x onerror="window.__toast_xss__=1">'
    showToast(payload, 'warning')

    const toast = document.querySelector('#toast-container .alert') as HTMLElement | null
    expect(toast).toBeTruthy()
    // Should not create an <img> element
    expect(toast!.querySelector('img')).toBeNull()
    // The raw characters should appear in textContent
    expect(toast!.textContent || '').toContain('<img')

    // Ensure auto-dismiss still works
    vi.advanceTimersByTime(3000)
    expect(document.querySelector('#toast-container .alert')).toBeNull()
  })
})

