'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false) // ✨ Added for Portal hydration safety

  const widgetContext: AIInsightWidgetContext = {
    widgetId,
    widgetKind,
    templateKey,
    sqlText,
    dataSample,
    selectedRow,
    selectedRowEvidence,
  }

  // Ensure component is mounted before using portals
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // Prevents background scrolling
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // ✨ The Modal Content extracted so we can Portal it
  const modalContent = open && mounted ? (
    <div
      // ✨ z-[99999] ensures it sits on top of absolutely everything
      className="fixed inset-0 z-[99999] bg-slate-900/20 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 text-left transition-colors duration-300 animate-in fade-in"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`AI Insights - ${title}`}
    >
      <div
        className="relative w-full max-w-4xl h-[90dvh] sm:h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl text-left transition-colors duration-300 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Cortex Insight
            </p>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate mt-0.5">{title}</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
            aria-label="Close AI insights"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
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
  ) : null

  return (
    <>
      <div className={`${inline ? '' : `mt-4 pt-2 ${className}`}`.trim()}>
        <div className="group inline-flex">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`inline-flex items-center gap-1.5 border text-[11px] font-bold tracking-wide uppercase transition-all duration-300 shadow-sm ${
              inline ? 'rounded-md px-2 py-1' : 'rounded-full px-3 py-1.5'
            } bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-300 dark:hover:border-blue-400`}
            title={`Open Cortex insight for ${title}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
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

      {/* ✨ Safely portal the modal to the document body so it escapes the parent card */}
      {mounted && open && createPortal(modalContent, document.body)}
    </>
  )
}