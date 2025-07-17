/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./panel.html",
    "./panel.ts", 
    "./task-row.ts",
    "./utils/*.ts",
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./dist/*.js",
    "./dist/*.html"
  ],
  safelist: [
    // Core daisyUI components
    'navbar', 'navbar-start', 'navbar-end',
    'btn', 'btn-primary', 'btn-error', 'btn-ghost', 'btn-sm', 'btn-success', 'btn-outline',
    'badge', 'badge-outline',
    'hero', 'hero-content',
    'modal', 'modal-open', 'modal-box', 'modal-action',
    'toast', 'toast-end', 'toast-start',
    'alert', 'alert-success',
    'card', 'card-body',
    'checkbox', 'checkbox-primary',
    'textarea', 'textarea-bordered',
    
    // Theme system
    'bg-base-100', 'bg-base-200', 'bg-base-300',
    'text-base-content', 'text-base-content/70', 'text-base-content/60',
    'border-base-300', 'text-primary',
    
    // Custom grid layouts
    'grid-cols-[auto_1fr_auto_auto]',
    
    // Layout utilities that may be dynamically generated
    'min-w-\\[\\d+px\\]',
    'transition-all', 'duration-300', 'duration-200', 'ease-in-out',
    'shadow-xl', 'shadow-2xl', 'hover:shadow-2xl',
    'opacity-70', 'animate-pulse'
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Menlo', 'monospace'],
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#3b82f6",
          "secondary": "#22c55e", 
          "accent": "#f59e0b",
          "neutral": "#374151",
          "base-100": "#ffffff",
          "base-200": "#f3f4f6",
          "base-300": "#e5e7eb",
          "base-content": "#1f2937",
          "info": "#0ea5e9",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
        dark: {
          "primary": "#60a5fa",
          "secondary": "#4ade80",
          "accent": "#fbbf24",
          "neutral": "#1f2937",
          "base-100": "#111827",
          "base-200": "#1f2937",
          "base-300": "#374151",
          "base-content": "#f9fafb",
          "info": "#38bdf8",
          "success": "#34d399",
          "warning": "#fbbf24",
          "error": "#f87171",
        },
      },
    ],
    logs: false,
  },
}