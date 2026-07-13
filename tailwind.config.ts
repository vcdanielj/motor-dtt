import type { Config } from 'tailwindcss'
import { tokens } from './src/lib/tokens'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: tokens.navy, 'navy-deep': tokens.navyDeep, red: tokens.red, 'red-deep': tokens.redDeep,
        green: tokens.green, amber: tokens.amber, gold: tokens.gold, cyan: tokens.cyan,
        ink: tokens.ink, slate: tokens.slate, 'slate-2': tokens.slate2, line: tokens.line,
        bg: tokens.bg, panel: tokens.panel,
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
