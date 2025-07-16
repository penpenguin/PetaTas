const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

const isProd = process.argv.includes('--prod');

async function build() {
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  // Copy static files
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  fs.copyFileSync('panel.html', 'dist/panel.html');
  
  // Process CSS with PostCSS and Tailwind
  const css = fs.readFileSync('styles.css', 'utf8');
  const result = await postcss([tailwindcss, autoprefixer])
    .process(css, { from: 'styles.css', to: 'dist/styles.css' });
  
  fs.writeFileSync('dist/styles.css', result.css);
  if (result.map) {
    fs.writeFileSync('dist/styles.css.map', result.map.toString());
  }

  // Build TypeScript files
  await esbuild.build({
    entryPoints: ['panel.ts', 'task-row.ts', 'background.ts'],
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    target: 'es2020',
    minify: isProd,
    sourcemap: !isProd,
    platform: 'browser',
    external: [],
    define: {
      'process.env.NODE_ENV': isProd ? '"production"' : '"development"'
    },
    loader: {
      '.ts': 'ts'
    }
  });

  console.log(`Build completed ${isProd ? '(production)' : '(development)'}`);
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});