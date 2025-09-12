import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import showToast from '../../src/utils/toast'

describe('Toast success color', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id=\"toast-container\"></div>
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

  it('adds an explicit green background for success toasts', () => {
    showToast('OK', 'success')
    const toast = document.querySelector('#toast-container .alert') as HTMLElement | null
    expect(toast).toBeTruthy()
    // enforce green background + readable text
    expect(toast!.className).toContain('bg-green-600')
    expect(toast!.className).toContain('text-white')

    // auto-dismiss still works
    vi.advanceTimersByTime(3000)
    expect(document.querySelector('#toast-container .alert')).toBeNull()
  })
})

