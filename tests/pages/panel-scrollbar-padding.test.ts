import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Panel scrollbar padding', () => {
  it('removes main content horizontal padding; adds slightly larger left/right padding on the scroll container', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    // Ensure the vertical scroll container has slightly larger left/right padding (pl-2.5, pr-2.5)
    expect(content).toMatch(/class=\"[^\"]*overflow-y-scroll[^\"]*pl-2\.5/)
    expect(content).toMatch(/class=\"[^\"]*overflow-y-scroll[^\"]*pr-2\.5/)
    // Ensure the main content container does NOT have horizontal padding (px-4 removed), but keeps py-0
    expect(content).toMatch(/class=\"[^\"]*mx-auto[^\"]*py-0/)
    expect(content).not.toMatch(/class=\"[^\"]*mx-auto[^\"]*px-4/)
    // Ensure the card list has top/bottom margin for spacing from body (attribute order agnostic)
    expect(content).toMatch(/<div[^>]*(id=\"task-list\"[^>]*class=\"[^\"]*\bmy-2\b|class=\"[^\"]*\bmy-2\b[^\"]*\"[^>]*id=\"task-list\")/)
  })
})
