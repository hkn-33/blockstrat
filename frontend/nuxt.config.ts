import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/color-mode'],
  // Light or dark follows the system until the visitor picks one; the class goes on <html>.
  colorMode: { preference: 'system', fallback: 'dark', classSuffix: '', storageKey: 'blockstrat-theme' },
  routeRules: {
    // The landing page is plain HTML for search engines and fast first paint.
    '/': { prerender: true },
    // The builder needs Blockly and the charts, which only run in the browser.
    '/app': { ssr: false },
  },
  css: ['~/assets/css/main.css', '~/assets/css/rules.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      title: 'BlockStrat: build and test trading strategies from blocks',
      meta: [{ name: 'description', content: 'Snap together a trading strategy from blocks, or describe it in plain words, and see how it would have done on years of real crypto prices. No code.' }],
      link: [
        { rel: 'preconnect', href: 'https://api.fontshare.com' },
        { rel: 'stylesheet', href: 'https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: { apiBase: 'http://127.0.0.1:8000' },
  },
  typescript: { strict: true },
})
