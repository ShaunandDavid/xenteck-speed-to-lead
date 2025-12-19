import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // XenTeck brand colors
        xenteck: {
          blue: '#00A3E0',
          dark: '#0a0a0a',
        }
      }
    },
  },
  plugins: [],
}
export default config
