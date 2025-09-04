import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// daisyUI v5 reads theme configuration from plugin options (not config.daisyui)
// Guard that our Tailwind config enables fantasy (default) and abyss (prefers dark)
describe('daisyUI theme configuration', () => {
  it('configures daisyUI plugin with fantasy --default and abyss --prefersdark', () => {
    const file = resolve(process.cwd(), 'tailwind.config.mjs')
    const content = readFileSync(file, 'utf8')

    // Very lightweight string assertions to avoid ESM/plugin introspection
    expect(content).toMatch(/daisyui\(\{/)
    expect(content).toMatch(/themes:\s*\[/)
    expect(content).toMatch(/fantasy\s*--default/)
    expect(content).toMatch(/abyss\s*--prefersdark/)
  })
})
