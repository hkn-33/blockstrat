// Simple or advanced. Simple keeps the builder to what a first strategy needs; advanced adds the tools that
// take explaining: groups inside groups, "not", weighted signals and the strategy's JSON. A strategy that
// already uses them shows them in either mode; the mode only decides which controls are offered.
const MODE_KEY = 'blockstrat:advanced'

function readStoredMode(): boolean {
  try {
    return window.localStorage.getItem(MODE_KEY) === '1'
  }
  catch {
    return false
  }
}

export function useBuilderMode() {
  const isAdvanced = useState('builder-advanced', readStoredMode)

  function setAdvanced(value: boolean): void {
    isAdvanced.value = value
    try {
      if (value) window.localStorage.setItem(MODE_KEY, '1')
      else window.localStorage.removeItem(MODE_KEY)
    }
    catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }

  return { isAdvanced, setAdvanced }
}
