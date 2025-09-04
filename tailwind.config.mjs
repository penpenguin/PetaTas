/** @type {import('tailwindcss').Config} */
import daisyui from 'daisyui'

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Menlo',
          'monospace',
        ],
      },
    },
  },
  // daisyUI v5 uses plugin options for themes configuration
  // Enable fantasy (as default light) and abyss (as prefers-dark)
  plugins: [
    daisyui({
      themes: ['fantasy --default', 'abyss --prefersdark'],
      logs: false,
    }),
  ],
}
