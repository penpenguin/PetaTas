import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('index.astro script policy (MV3 safe)', () => {
  const file = resolve(process.cwd(), 'src/pages/index.astro')
  const content = readFileSync(file, 'utf8')

  it('does not use inline scripts (no is:inline)', () => {
    expect(content).not.toMatch(/<script[^>]*is:inline/i)
  })

  it('references external client script /panel-client.js', () => {
    expect(content).toMatch(/<script[^>]*src=\"\/panel-client\.js\"/)
  })
})

