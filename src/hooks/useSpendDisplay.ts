'use client'

import { formatCredits, formatCurrency } from '@/lib/formatting'
import { useDisplaySettingsStore } from '@/stores/displaySettings'

const toNumber = (value: number | null | undefined) => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function useSpendDisplay() {
  const spendDisplayMode = useDisplaySettingsStore((s) => s.spendDisplayMode)
  const usdPerCredit = useDisplaySettingsStore((s) => s.usdPerCredit)

  const isUsd = spendDisplayMode === 'usd'

  const convertCredits = (credits: number | null | undefined) => {
    const n = toNumber(credits)
    return isUsd ? n * usdPerCredit : n
  }

  const formatCreditValue = (credits: number | null | undefined) => {
    const n = toNumber(credits)
    return isUsd ? formatCurrency(n * usdPerCredit) : formatCredits(n)
  }

  const formatCreditValueWithUnit = (credits: number | null | undefined) => {
    const formatted = formatCreditValue(credits)
    return isUsd ? formatted : `${formatted} credits`
  }

  const creditUnitLabel = isUsd ? 'USD' : 'Credits'
  const creditUnitShortLabel = isUsd ? '$' : 'credits'

  return {
    spendDisplayMode,
    usdPerCredit,
    isUsd,
    creditUnitLabel,
    creditUnitShortLabel,
    convertCredits,
    formatCreditValue,
    formatCreditValueWithUnit,
  }
}
