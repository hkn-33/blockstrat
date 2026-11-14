// Picking the theme the browser already asks for hands control back to the browser, so one stray click
// is undone by the next and the page follows the system again.
export function useThemeToggle(): { isDark: ComputedRef<boolean>, toggleTheme: () => void } {
  const colorMode = useColorMode()
  const isDark = computed(() => colorMode.value !== 'light')

  function toggleTheme(): void {
    const wanted = isDark.value ? 'light' : 'dark'
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    colorMode.preference = wanted === (systemIsDark ? 'dark' : 'light') ? 'system' : wanted
  }

  return { isDark, toggleTheme }
}
