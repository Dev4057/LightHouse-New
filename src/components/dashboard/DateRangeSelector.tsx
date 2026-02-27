'use client'

import { useState } from 'react'
import { Calendar, X } from 'lucide-react'

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

  const handlePreset = (days: number) => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - days)
    onChange({ start, end })
    setShowPicker(false)
  }

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
      >
        <Calendar className="w-5 h-5" />
        <span className="text-sm font-medium">
          {formatDate(value.start)} - {formatDate(value.end)}
        </span>
      </button>

      {showPicker && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-700 border border-slate-600 rounded-lg shadow-xl p-4 z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-100">Select Date Range</h3>
            <button
              onClick={() => setShowPicker(false)}
              className="p-1 hover:bg-slate-600 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Quick Select
            </div>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => handlePreset(preset.days)}
                  className="px-3 py-2 bg-slate-600 text-slate-200 rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-600 pt-4 mt-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Custom Range
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300">Start Date</label>
                  <input
                    type="date"
                    value={value.start.toISOString().split('T')[0]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        start: new Date(e.target.value),
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300">End Date</label>
                  <input
                    type="date"
                    value={value.end.toISOString().split('T')[0]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        end: new Date(e.target.value),
                      })
                    }
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPicker(false)}
              className="w-full mt-4 btn-primary"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
