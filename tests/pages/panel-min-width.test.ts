import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Side panel width constraints', () => {
  it('declares min-w-[360px] to match Chrome panel minimum', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    // Keep explicit minimum width to match Chrome panel behavior (attribute order agnostic)
    expect(content).toMatch(/<div[^>]*(id=\"panel-root\"[^>]*class=\"[^\"]*min-w-\[360px\][^\"]*\"|class=\"[^\"]*min-w-\[360px\][^\"]*\"[^>]*id=\"panel-root\")/)
  })

  it('uses w-full on the root container', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    // Fill the available panel width without exceeding it
    expect(content).toMatch(/id=\"panel-root\"[^>]*class=\"[^\"]*\bw-full\b[^\"]*\"/)
  })
})
