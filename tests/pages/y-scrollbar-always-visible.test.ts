import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Vertical scrollbar visibility', () => {
  it('uses overflow-y-scroll on the main vertical scroll container', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    // Ensure we do NOT auto-hide vertical scrollbar
    expect(content).not.toMatch(/class=\"[^\"]*overflow-y-auto[^\"]*\"/)
    // Ensure we explicitly show vertical scrollbar and keep X hidden
    expect(content).toMatch(/class=\"[^\"]*overflow-y-scroll[^\"]*\"/)
    expect(content).toMatch(/class=\"[^\"]*overflow-x-hidden[^\"]*\"/)
  })
})
