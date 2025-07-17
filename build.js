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
  
  // Copy any other static assets if they exist
  const staticFiles = ['icons'];
  staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
      if (fs.statSync(file).isDirectory()) {
        if (!fs.existsSync(`dist/${file}`)) {
          fs.mkdirSync(`dist/${file}`, { recursive: true });
        }
        fs.readdirSync(file).forEach(subFile => {
          fs.copyFileSync(`${file}/${subFile}`, `dist/${file}/${subFile}`);
        });
      } else {
        fs.copyFileSync(file, `dist/${file}`);
      }
    }
  });
  
  // Process CSS with PostCSS and Tailwind
  console.log('Processing CSS with Tailwind...');
  const css = fs.readFileSync('styles.css', 'utf8');
  const result = await postcss([
    tailwindcss({
      config: './tailwind.config.js'
    }),
    autoprefixer
  ]).process(css, { 
    from: 'styles.css', 
    to: 'dist/styles.css',
    map: !isProd ? { inline: false } : false
  });
  
  fs.writeFileSync('dist/styles.css', result.css);
  if (result.map) {
    fs.writeFileSync('dist/styles.css.map', result.map.toString());
  }

  console.log(`✅ CSS processed: ${(result.css.length / 1024).toFixed(1)}KB generated`);
  
  // Verify essential CSS classes are present
  const hasEssentialClasses = result.css.includes('.btn') && 
                              result.css.includes('.navbar') && 
                              result.css.includes('.modal');
  
  if (!hasEssentialClasses) {
    console.warn('⚠️ Warning: Essential daisyUI classes may be missing from CSS output');
  } else {
    console.log('✅ Essential daisyUI classes found in CSS output');
  }

  // Build TypeScript files
  console.log('Building TypeScript files...');
  await esbuild.build({
    entryPoints: ['src/components/panel.ts', 'src/components/task-row.ts', 'src/background.ts'],
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
    },
    logLevel: 'info',
    metafile: !isProd,
    splitting: false // Disable for Chrome extension compatibility
  });
  
  console.log('✅ TypeScript build completed');

  console.log(`Build completed ${isProd ? '(production)' : '(development)'}`);
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});