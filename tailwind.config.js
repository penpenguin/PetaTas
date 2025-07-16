/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./panel.html",
    "./panel.ts", 
    "./task-row.ts",
    "./utils/*.ts",
    "./dist/*.js"
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
          "info": "#38bdf8",
          "success": "#34d399",
          "warning": "#fbbf24",
          "error": "#f87171",
        },
      },
    ],
  },
}