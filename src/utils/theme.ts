/**
 * Applies PetaTas theme based on user's system preference and observes changes.
 * - Dark system => data-theme="abyss"
 * - Light system => data-theme="fantasy"
 * Safe to call multiple times; adds a single listener per page session.
 */
export function initSystemThemeSync(doc: Document = document, win: Window = window): void {
  const root = doc.documentElement

  // Prevent duplicate listeners if called multiple times
  if ((root as HTMLElement).dataset.themeSyncBound === '1') {
    return
  }
  (root as HTMLElement).dataset.themeSyncBound = '1'

  const apply = (isDark: boolean) => {
    const theme = isDark ? 'abyss' : 'fantasy'
    if (root.getAttribute('data-theme') !== theme) {
      root.setAttribute('data-theme', theme)
    }
    // Hint to UA for form controls, scrollbars, etc.
  try {
    (root as HTMLElement).style.colorScheme = isDark ? 'dark' : 'light'
    } catch {
      // ignore style issues in older environments
    }
  }

  try {
    const mql = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: dark)') : null
    if (!mql) {
      // No matchMedia support; rely on default in markup
      return
    }

    // Initial apply based on current system preference
    apply(mql.matches)

    // Observe future changes (newer and legacy APIs)
    const onChange = (e: MediaQueryListEvent) => apply(e.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
    } else {
      // Fallback for legacy environments
      mql.onchange = onChange
    }

    // Also re-apply on window focus/visibility/page show to cover hosts that
    // don't dispatch matchMedia change while the panel is hidden.
    const reapply = () => apply(mql.matches)
    if (typeof win.addEventListener === 'function') {
      win.addEventListener('focus', reapply)
      win.addEventListener('pageshow', reapply)
    }
    if (typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', reapply)
    }
  } catch {
    // Silently ignore any environment-specific errors
  }
}
