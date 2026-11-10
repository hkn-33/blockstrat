import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  routeRules: {
    // The landing page is plain HTML for search engines and fast first paint.
    '/': { prerender: true },
    // The builder needs Blockly and the charts, which only run in the browser.
    '/app': { ssr: false },
  },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      title: 'BlockStrat: build and test trading strategies from blocks',
      meta: [{ name: 'description', content: 'Snap together a trading strategy from blocks, or describe it in plain words, and see how it would have done on years of real crypto prices. No code.' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: { apiBase: 'http://127.0.0.1:8000' },
  },
  typescript: { strict: true },
})
