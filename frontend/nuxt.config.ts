import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/color-mode', '@nuxt/fonts'],
  // Fonts are downloaded at build time and served from the site itself, so no visitor's address reaches a font CDN.
  fonts: {
    families: [
      { name: 'Satoshi', provider: 'fontshare', weights: [400, 500, 700, 900] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500] },
    ],
    defaults: { styles: ['normal'], subsets: ['latin', 'latin-ext'] },
  },
  // Light or dark follows the system until the visitor picks one; the class goes on <html>.
  colorMode: { preference: 'system', fallback: 'dark', classSuffix: '', storageKey: 'blockstrat-theme' },
  routeRules: {
    // The landing page is plain HTML for search engines and fast first paint.
    '/': { prerender: true },
    '/privacy': { prerender: true },
    '/terms': { prerender: true },
    // The builder needs Blockly and the charts, which only run in the browser.
    '/app': { ssr: false },
  },
  css: ['~/assets/css/main.css', '~/assets/css/rules.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'BlockStrat: no-code crypto strategy builder and backtester',
      // Shared by every page; each page sets its own title, description and address (usePageMeta).
      meta: [
        { name: 'description', content: 'Build a crypto trading strategy from blocks or describe it to the AI assistant, then backtest it on years of real Binance prices with fees. Free, no code, no sign-up.' },
        { property: 'og:site_name', content: 'BlockStrat' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: 'https://blockstrat.vercel.app/og.jpg' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: 'https://blockstrat.vercel.app/og.jpg' },
      ],
      // The SVG follows the system theme; the .ico is the fallback for browsers without SVG icons.
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      ],
    },
  },
  runtimeConfig: {
    public: { apiBase: 'http://127.0.0.1:8000' },
  },
  typescript: { strict: true },
})
