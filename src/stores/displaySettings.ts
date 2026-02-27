'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type SpendDisplayMode = 'credits' | 'usd'

export const DEFAULT_USD_PER_CREDIT = 3

interface DisplaySettingsState {
  spendDisplayMode: SpendDisplayMode
  usdPerCredit: number
  setSpendDisplayMode: (mode: SpendDisplayMode) => void
  setUsdPerCredit: (rate: number) => void
}

export const useDisplaySettingsStore = create<DisplaySettingsState>()(
  persist(
    (set) => ({
      spendDisplayMode: 'credits',
      usdPerCredit: DEFAULT_USD_PER_CREDIT,
      setSpendDisplayMode: (mode) => set({ spendDisplayMode: mode }),
      setUsdPerCredit: (rate) =>
        set({
          usdPerCredit:
            Number.isFinite(rate) && rate > 0 ? Math.min(Math.max(rate, 0.0001), 100000) : DEFAULT_USD_PER_CREDIT,
        }),
    }),
    {
      name: 'lighthouse-display-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        spendDisplayMode: state.spendDisplayMode,
        usdPerCredit: state.usdPerCredit,
      }),
    }
  )
)
