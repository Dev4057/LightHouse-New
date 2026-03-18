'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, X, ChevronDown } from 'lucide-react'

interface DateRange {
  start: Date
  end: Date
}

interface DateRangeSelectorProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const presets = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
]

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [showPicker, setShowPicker] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handlePreset = (days: number) => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - days)
    onChange({ start, end })
    setShowPicker(false)
  }

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* TRIGGER BUTTON */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all duration-200 ${
          showPicker 
            ? 'bg-blue-50 dark:bg-slate-800/80 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-blue-600 dark:text-blue-400' 
            : 'bg-white/80 dark:bg-slate-900/50 backdrop-blur-md border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <Calendar className="w-4 h-4" />
        <span className="text-sm font-semibold tracking-wide">
          {formatDate(value.start)} - {formatDate(value.end)}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ml-1 ${showPicker ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''}`} />
      </button>

      {/* DROPDOWN MENU */}
      {showPicker && (
        <div className="absolute right-0 mt-3 w-80 bg-white/95 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Select Date Range</h3>
            <button
              onClick={() => setShowPicker(false)}
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-5">
            
            {/* Quick Select Presets */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Quick Select
              </div>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => handlePreset(preset.days)}
                    className="px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-blue-500 dark:hover:bg-blue-500 hover:border-blue-400 hover:text-white dark:hover:text-white hover:shadow-[0_0_12px_rgba(59,130,246,0.4)] transition-all text-xs font-medium"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range Inputs */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Custom Range
              </div>
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800/50">
                
                {/* Start Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">START DATE</label>
                  <input
                    type="date"
                    value={value.start.toISOString().split('T')[0]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        start: new Date(e.target.value),
                      })
                    }
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all custom-date-input w-full"
                  />
                </div>
                
                {/* End Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">END DATE</label>
                  <input
                    type="date"
                    value={value.end.toISOString().split('T')[0]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        end: new Date(e.target.value),
                      })
                    }
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all custom-date-input w-full"
                  />
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => setShowPicker(false)}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
            >
              Apply Selection
            </button>
          </div>
        </div>
      )}
    </div>
  )
}