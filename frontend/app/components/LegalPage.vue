<script setup lang="ts">
export interface LegalSection {
  id: string
  title: string
}

defineProps<{ title: string, summary: string, sections: LegalSection[] }>()

const { toggleTheme } = useThemeToggle()
</script>

<template>
  <div class="lp">
    <header class="legal-nav">
      <div class="wrap legal-nav-bar">
        <NuxtLink to="/" class="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4" aria-label="BlockStrat home">
          <BrandLogo />
        </NuxtLink>
        <div class="flex items-center gap-2">
          <button type="button" class="theme-toggle" aria-label="Switch between light and dark mode" @click="toggleTheme">
            <UiIcon name="sun" class="theme-icon theme-icon--sun" />
            <UiIcon name="moon" class="theme-icon theme-icon--moon" />
          </button>
          <NuxtLink to="/app" class="btn btn-lime btn-small">
            Open the builder
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="wrap legal-layout">
      <div class="legal-head">
        <h1 class="section-title">
          {{ title }}
        </h1>
        <p class="legal-summary">
          {{ summary }}
        </p>
        <p class="legal-updated">
          Last updated {{ LEGAL_UPDATED }}
        </p>
      </div>

      <nav class="legal-toc" aria-label="On this page">
        <p class="toc-heading">
          On this page
        </p>
        <ol>
          <li v-for="section in sections" :key="section.id">
            <a :href="`#${section.id}`" class="toc-link">{{ section.title }}</a>
          </li>
        </ol>
      </nav>

      <article class="legal-body">
        <slot />
      </article>
    </main>

    <footer class="wrap legal-footer">
      <p>© 2026 BlockStrat</p>
      <nav aria-label="Legal" class="legal-footer-links">
        <NuxtLink to="/terms" class="footer-link">Terms of Service</NuxtLink>
        <NuxtLink to="/privacy" class="footer-link">Privacy Policy</NuxtLink>
        <a :href="`mailto:${OPERATOR.email}`" class="footer-link">{{ OPERATOR.email }}</a>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.lp {
  min-height: 100vh;
  background: var(--page);
  color: var(--ink);
}

.legal-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--line);
  background: var(--nav-glass);
  backdrop-filter: blur(14px) saturate(1.4);
}

.legal-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.75rem;
}

.legal-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2.5rem;
  padding-block: 4rem 6rem;
}

@media (min-width: 1024px) {
  .legal-layout {
    grid-template-columns: 15rem minmax(0, 46rem);
    column-gap: 4rem;
    padding-top: 6rem;
  }

  .legal-head {
    grid-column: 2;
  }

  .legal-toc {
    grid-row: 2;
    align-self: start;
    position: sticky;
    top: 6rem;
  }
}

.legal-summary {
  margin-top: 1.25rem;
  max-width: 40rem;
  font-size: 18px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.legal-updated {
  margin-top: 1rem;
  font-size: 13px;
  color: var(--muted);
}

.toc-heading {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.legal-toc ol {
  display: grid;
  gap: 0.15rem;
  margin-top: 0.75rem;
}

.toc-link {
  display: block;
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  margin-inline: -0.6rem;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ink-soft);
  transition: background-color 160ms, color 160ms;
}

.toc-link:hover {
  background: var(--tint);
  color: var(--ink);
}

.toc-link:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* The documents' own text, written in the pages as plain headings, paragraphs, lists and one table. */
.legal-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink-soft);
}

.legal-body :deep(section) {
  scroll-margin-top: 6rem;
}

.legal-body :deep(section + section) {
  margin-top: 3rem;
}

.legal-body :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ink);
  text-wrap: balance;
}

.legal-body :deep(h3) {
  margin-top: 1.5rem;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.legal-body :deep(p),
.legal-body :deep(ul),
.legal-body :deep(ol) {
  margin-top: 0.85rem;
}

.legal-body :deep(ul) {
  display: grid;
  gap: 0.45rem;
  padding-left: 1.2rem;
  list-style: disc;
}

.legal-body :deep(ol) {
  display: grid;
  gap: 0.45rem;
  padding-left: 1.4rem;
  list-style: decimal;
}

.legal-body :deep(li)::marker {
  color: var(--muted);
}

.legal-body :deep(strong) {
  font-weight: 700;
  color: var(--ink);
}

.legal-body :deep(a) {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-color: var(--line);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  transition: text-decoration-color 160ms;
}

.legal-body :deep(a:hover) {
  text-decoration-color: var(--accent-ink);
}

.legal-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ink);
  overflow-wrap: anywhere;
}

/* A note that matters more than the text around it: the not-investment-advice warning. */
.legal-body :deep(.callout) {
  margin-top: 1rem;
  border-radius: 14px;
  background: var(--result-bg);
  padding: 1rem 1.25rem;
  color: var(--ink);
}

.legal-body :deep(.table-scroll) {
  margin-top: 1rem;
  overflow-x: auto;
}

.legal-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.5;
}

.legal-body :deep(th),
.legal-body :deep(td) {
  border-top: 1px solid var(--line);
  padding: 0.65rem 1rem 0.65rem 0;
  text-align: left;
  vertical-align: top;
}

.legal-body :deep(thead th) {
  border-top: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.legal-body :deep(tbody th) {
  min-width: 9rem;
  font-weight: 700;
  color: var(--ink);
}

.legal-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 2rem;
  border-top: 1px solid var(--line);
  padding-block: 2rem;
  font-size: 14px;
  color: var(--muted);
}

.legal-footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.footer-link {
  color: var(--ink-soft);
}
</style>
