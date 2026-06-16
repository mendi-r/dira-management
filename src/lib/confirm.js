// Global confirm handler — overrides window.confirm with internal dialog
let _handler = null

export function _setHandler(fn) { _handler = fn }

export async function confirm(message, opts = {}) {
  if (_handler) return _handler(message, opts)
  return window.confirm(message) // fallback if dialog not mounted yet
}
