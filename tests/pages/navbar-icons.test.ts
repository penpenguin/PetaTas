import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Navbar icons in Actions UI', () => {
  it('renders icon elements in trigger and menu items', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')

    // Trigger button uses an inline SVG icon
    expect(content).toMatch(/<label[^>]*class=\"[^\"]*btn[^\"]*\"[^>]*>[\s\S]*?<svg/i)

    // Each menu item button contains an SVG icon
    expect(content).toMatch(/id=\"paste-button\"[\s\S]*?<svg/i)
    expect(content).toMatch(/id=\"add-task-button\"[\s\S]*?<svg/i)
    expect(content).toMatch(/id=\"export-button\"[\s\S]*?<svg/i)
    expect(content).toMatch(/id=\"clear-all-button\"[\s\S]*?<svg/i)
  })
})
