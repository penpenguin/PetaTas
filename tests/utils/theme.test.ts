import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('System theme auto-switch', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html data-theme="fantasy"><body></body></html>')
    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any
  })

  it('applies abyss theme when prefers-color-scheme: dark matches', async () => {
    const listeners: Array<(e: any) => void> = []
    const mql = {
      matches: true,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn((_, cb) => listeners.push(cb as any)),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatch: (matches: boolean) => listeners.forEach((cb) => cb({ matches }))
    } as unknown as MediaQueryList

    // @ts-expect-error test stub
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { initSystemThemeSync } = await import('../../src/utils/theme.ts')
    initSystemThemeSync()

    expect(document.documentElement.getAttribute('data-theme')).toBe('abyss')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    // simulate system change back to light
    mql.dispatch(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('fantasy')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('keeps default light theme when matchMedia is unavailable', async () => {
    // @ts-expect-error test stub
    window.matchMedia = undefined
    const { initSystemThemeSync } = await import('../../src/utils/theme.ts')
    initSystemThemeSync()
    expect(document.documentElement.getAttribute('data-theme')).toBe('fantasy')
  })

  it('re-applies theme on window focus/visibility change', async () => {
    let currentMatches = false
    const listeners: Array<(e?: any) => void> = []
    const mql = {
      get matches() { return currentMatches },
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList

    // @ts-expect-error test stub
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const addDocListenerSpy = vi.spyOn(document, 'addEventListener')

    const { initSystemThemeSync } = await import('../../src/utils/theme.ts')
    initSystemThemeSync()
    expect(document.documentElement.getAttribute('data-theme')).toBe('fantasy')

    // Flip to dark and simulate focus
    currentMatches = true
    // @ts-expect-error dispatch focus
    window.dispatchEvent(new window.Event('focus'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('abyss')

    // Flip back and simulate visibility change
    currentMatches = false
    document.dispatchEvent(new window.Event('visibilitychange'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('fantasy')

    // clean up spies
    addEventListenerSpy.mockRestore()
    addDocListenerSpy.mockRestore()
  })
})
