import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Reduce custom CSS in main.css', () => {
  const css = readFileSync(resolve(process.cwd(), 'src', 'styles', 'main.css'), 'utf8')

  const mustNotHave = [
    /\.list-row\.status-[^{]+\{/,
    /\.list-col-grow\b/,
    /\.task-name\b/,
    /\.notes-container\b/,
    /\.notes-display\b/,
    /\.notes-input\b/,
    /\.timer-display\b/,
    /\.empty-state\b/,
    /\.delete-button\b/,
    /[^-]\.hidden\b/, // avoid matching Tailwind directive comments
    /[^-]\.container\b/,
  ]

  it('does not define component-specific selectors (migrate to classes in markup)', () => {
    for (const re of mustNotHave) {
      expect(css).not.toMatch(re)
    }
  })
})

