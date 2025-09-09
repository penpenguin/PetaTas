import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Panel scrollbar padding', () => {
  it('removes main content horizontal padding; keeps right padding only on the scroll container', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    // Ensure the vertical scroll container has a small right padding (pr-1)
    expect(content).toMatch(/class=\"[^\"]*overflow-y-auto[^\"]*pr-1/)
    // Ensure the main content container does NOT have horizontal padding (px-4 removed), but keeps py-0
    expect(content).toMatch(/class=\"[^\"]*mx-auto[^\"]*py-0/)
    expect(content).not.toMatch(/class=\"[^\"]*mx-auto[^\"]*px-4/)
    // Ensure the card list has top/bottom margin for spacing from body (attribute order agnostic)
    expect(content).toMatch(/<div[^>]*(id=\"task-list\"[^>]*class=\"[^\"]*\bmy-2\b|class=\"[^\"]*\bmy-2\b[^\"]*\"[^>]*id=\"task-list\")/)
  })
})
