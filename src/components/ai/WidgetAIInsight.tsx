'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import AIInsightsPanel, { type AIInsightWidgetContext } from '@/components/dashboard/AIInsightsPanel'

interface WidgetAIInsightProps {
  title: string
  widgetType: string
  dateRange: { start: Date; end: Date }
  className?: string
  inline?: boolean
  label?: string
  widgetId?: string
  widgetKind?: string
  templateKey?: string
  sqlText?: string
  dataSample?: unknown
  selectedRow?: Record<string, unknown> | null
  selectedRowEvidence?: Record<string, unknown> | null
}

export default function WidgetAIInsight({
  title,
  widgetType,
  dateRange,
  className = '',
  inline = false,
  label = 'Cortex Insight',
  widgetId,
  widgetKind = 'widget',
  templateKey,
  sqlText,
  dataSample,
  selectedRow = null,
  selectedRowEvidence = null,
}: WidgetAIInsightProps) {
  const [open, setOpen] = useState(false)
  const widgetContext: AIInsightWidgetContext = {
    widgetId,
    widgetKind,
    templateKey,
    sqlText,
    dataSample,
    selectedRow,
    selectedRowEvidence,
  }

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <div className={`${inline ? '' : `mt-4 pt-2 ${className}`}`.trim()}>
        <div className="group inline-flex">
          <button
            type="button"
            onClick={() => setOpen(true)}
            // Theme-Aware Button: Light Mode (Blue) / Dark Mode (Cyan)
            className={`inline-flex items-center gap-2 border text-xs transition-colors ${
              inline ? 'rounded-md px-2 py-1' : 'rounded-full px-2.5 py-1.5'
            } border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 dark:border-cyan-700/50 dark:bg-cyan-950/30 dark:text-cyan-200 dark:hover:bg-cyan-900/40 dark:hover:border-cyan-500/60`}
            title={`Open Cortex insight for ${title}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-cyan-300" />
            {inline ? (
              <span>{label}</span>
            ) : (
              <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-40 group-hover:opacity-100">
                {label}
              </span>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div
          // Light Mode overlay (transparent dark slate) vs Dark Mode overlay (deep black)
          className="fixed inset-0 z-[100] bg-slate-900/20 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 text-left transition-colors duration-300"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`AI Insights - ${title}`}
        >
          <div
            // The Glassmorphism Modal Container
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl shadow-2xl text-left flex flex-col transition-colors duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-blue-600 dark:text-cyan-300 font-bold">Cortex Insight</p>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close AI insights"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-64px)] scrollbar-thin">
              <AIInsightsPanel
                widgetType={widgetType}
                title={title}
                startDate={dateRange.start}
                endDate={dateRange.end}
                widgetContext={widgetContext}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}