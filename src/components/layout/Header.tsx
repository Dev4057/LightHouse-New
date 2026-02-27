'use client'

import { Menu, Bell, Settings, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import useFetch from '@/hooks/useApi'
import { DEFAULT_USD_PER_CREDIT, useDisplaySettingsStore } from '@/stores/displaySettings'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const spendDisplayMode = useDisplaySettingsStore((s) => s.spendDisplayMode)
  const usdPerCredit = useDisplaySettingsStore((s) => s.usdPerCredit)
  const setSpendDisplayMode = useDisplaySettingsStore((s) => s.setSpendDisplayMode)
  const setUsdPerCredit = useDisplaySettingsStore((s) => s.setUsdPerCredit)
  const [usdRateDraft, setUsdRateDraft] = useState(String(usdPerCredit || DEFAULT_USD_PER_CREDIT))
  const { data: refreshStatus, error: refreshError } = useFetch<{ formatted: string }>(
    ['header-last-refresh'],
    '/api/system?type=last_refresh',
    { staleTime: 60_000, gcTime: 5 * 60_000 }
  )

  useEffect(() => {
    setUsdRateDraft(String(usdPerCredit || DEFAULT_USD_PER_CREDIT))
  }, [usdPerCredit])

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-20">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-200" />
          </button>
          <h2 className="text-lg font-semibold text-white">Snowflake Warehouse Monitor</h2>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors group"
            >
              <Bell className="w-5 h-5 text-slate-300 group-hover:text-white" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-600 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Notifications</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  <div className="p-3 bg-slate-600/50 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">Warehouse Performance</p>
                        <p className="text-xs text-slate-400 mt-1">Query queue ratio exceeded 0.8 on COMPUTE_WH</p>
                        <p className="text-xs text-slate-500 mt-2">2 minutes ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-600/50 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">Storage Alert</p>
                        <p className="text-xs text-slate-400 mt-1">Database storage growing at 15GB/day</p>
                        <p className="text-xs text-slate-500 mt-2">15 minutes ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-600/50 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">System Update</p>
                        <p className="text-xs text-slate-400 mt-1">Snowflake connection optimized</p>
                        <p className="text-xs text-slate-500 mt-2">1 hour ago</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-slate-600 text-center">
                  <button className="text-xs text-blue-400 hover:text-blue-300 font-medium">View all notifications</button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors group"
            >
              <Settings className="w-5 h-5 text-slate-300 group-hover:text-white" />
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-600 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Settings</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 font-medium">Spend Display</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSpendDisplayMode('credits')}
                        className={`rounded border px-3 py-2 text-sm ${
                          spendDisplayMode === 'credits'
                            ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                            : 'border-slate-600 bg-slate-800 text-slate-200'
                        }`}
                      >
                        Credits
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpendDisplayMode('usd')}
                        className={`rounded border px-3 py-2 text-sm ${
                          spendDisplayMode === 'usd'
                            ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                            : 'border-slate-600 bg-slate-800 text-slate-200'
                        }`}
                      >
                        USD
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">USD per credit</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={usdRateDraft}
                        onChange={(e) => setUsdRateDraft(e.target.value)}
                        onBlur={() => setUsdPerCredit(Number(usdRateDraft))}
                        className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current conversion used when USD mode is selected.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-sm text-slate-200">Enable Notifications</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-sm text-slate-200">Email Alerts</span>
                    </label>
                  </div>
                  <hr className="border-slate-600" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-2">Updates</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="updates"
                        defaultChecked
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-slate-200">Auto-update</span>
                    </label>
                    <label className="flex items-center gap-3 mt-2">
                      <input
                        type="radio"
                        name="updates"
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-sm text-slate-200">Manual update</span>
                    </label>
                  </div>
                  <hr className="border-slate-600" />
                  <a href="#" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 rounded transition-colors">
                    System Settings
                  </a>
                  <a href="#" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 rounded transition-colors">
                    API Configuration
                  </a>
                  <a href="#" className="block px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 rounded transition-colors">
                    Help & Docs
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-sm font-medium text-slate-200">User</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-lg py-2 z-50">
                <a href="#" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
                  Profile
                </a>
                <a href="#" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
                  Settings
                </a>
                <hr className="my-2 border-slate-600" />
                <a href="#" className="block px-4 py-2 text-sm text-red-400 hover:bg-slate-600">
                  Logout
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-6 py-2 bg-slate-700/50 border-t border-slate-700 text-xs text-slate-400 flex items-center justify-between">
        <span>Last updated: {refreshError ? '-' : (refreshStatus?.formatted || 'Loading...')}</span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Connected to Snowflake
        </span>
      </div>
    </header>
  )
}
