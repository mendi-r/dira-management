// הגדרות מקומיות — נשמרות ב-localStorage
const KEY = 'dira_settings'
const DEFAULTS = { soonDays: 30 }

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
