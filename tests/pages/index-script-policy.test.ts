import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('index.astro script policy (MV3 safe)', () => {
  const file = resolve(process.cwd(), 'src/pages/index.astro')
  const content = readFileSync(file, 'utf8')

  it('dev script explicitly uses is:inline for clarity', () => {
    // Ensure the development script tag carries is:inline to silence Astro hint
    // Attribute order can vary; assert both appear in the same <script> tag.
    expect(content).toMatch(/<script[^>]*(?=.*is:inline)(?=.*src=\"\/src\/panel-client\.ts\")[^>]*>/i)
  })

  it('references external client script /panel-client.js', () => {
    expect(content).toMatch(/<script[^>]*src=\"\/panel-client\.js\"/)
  })
})
