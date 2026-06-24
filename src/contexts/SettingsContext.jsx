import React, { createContext, useContext, useState } from 'react'
import { getSettings, saveSettings } from '../lib/settings'

const Ctx = createContext({ soonDays: 30, setSoonDays: () => {} })

export function SettingsProvider({ children }) {
  const [s, setS] = useState(getSettings)

  function setSoonDays(days) {
    const next = { ...s, soonDays: Number(days) }
    setS(next)
    saveSettings(next)
  }

  return <Ctx.Provider value={{ ...s, setSoonDays }}>{children}</Ctx.Provider>
}

export function useSettings() { return useContext(Ctx) }
