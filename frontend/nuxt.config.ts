import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Blockly and the charts are browser-only; the app is a single interactive page.
  ssr: false,
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      title: 'Strategy Lab',
      meta: [{ name: 'description', content: 'Build trading strategies from blocks and backtest them instantly.' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: { apiBase: 'http://127.0.0.1:8000' },
  },
  typescript: { strict: true },
})
