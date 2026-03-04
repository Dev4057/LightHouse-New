'use client'

import { ChevronLeft, Bell, Settings, User, X, Search, Command as CmdIcon, Menu, Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import useFetch from '@/hooks/useApi'
import { DEFAULT_USD_PER_CREDIT, useDisplaySettingsStore } from '@/stores/displaySettings'
import { useNotifications } from '@/hooks/useNotifications'
import { DialogTitle, DialogDescription } from '@radix-ui/react-dialog'
import { useTheme } from 'next-themes'

export default function Header({ onMenuClick, isSidebarOpen }: { onMenuClick: () => void; isSidebarOpen: boolean; }) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  
  // Theme State
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const spendDisplayMode = useDisplaySettingsStore((s) => s.spendDisplayMode)
  const usdPerCredit = useDisplaySettingsStore((s) => s.usdPerCredit)
  const setSpendDisplayMode = useDisplaySettingsStore((s) => s.setSpendDisplayMode)
  const setUsdPerCredit = useDisplaySettingsStore((s) => s.setUsdPerCredit)
  
  const { data: notifications, isLoading: notificationsLoading, isError: notificationsError } = useNotifications()
  const [usdRateDraft, setUsdRateDraft] = useState(String(usdPerCredit || DEFAULT_USD_PER_CREDIT))
  
  const { data: refreshStatus, error: refreshError } = useFetch<{ formatted: string }>(
    ['header-last-refresh'],
    '/api/system?type=last_refresh',
    { staleTime: 60_000, gcTime: 5 * 60_000 }
  )

  // Prevent hydration mismatch by mounting theme elements only on client
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setUsdRateDraft(String(usdPerCredit || DEFAULT_USD_PER_CREDIT))
  }, [usdPerCredit])

  // Command Palette Keyboard Shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCmdkOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setCmdkOpen(false)
    command()
  }

  return (
    <header className="bg-white/80 dark:bg-transparent dark:glass border-b border-slate-200 dark:border-slate-700/50 sticky top-0 z-20 backdrop-blur-md transition-colors duration-300">
      <div className="px-6 py-3 flex items-center justify-between">
        
        {/* Left side */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white group"
          >
            <ChevronLeft 
              className={`w-5 h-5 transition-transform duration-300 transform ${
                isSidebarOpen ? 'rotate-0' : '-rotate-180'
              }`} 
            />
          </button>
          
          {/* Command Palette Trigger */}
          <button 
            onClick={() => setCmdkOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-all w-64 group shadow-inner"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search anything...</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-500 dark:text-slate-400 group-hover:border-slate-400 dark:group-hover:border-slate-500">
              <CmdIcon className="w-3 h-3" /> K
            </kbd>
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Theme Toggle Button */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors group"
              aria-label="Toggle Dark Mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-slate-400 group-hover:text-yellow-400 transition-colors" />
              ) : (
                <Moon className="w-5 h-5 text-slate-500 group-hover:text-slate-900 transition-colors" />
              )}
            </button>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowSettings(false)
                setShowUserMenu(false)
              }}
              className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors group"
            >
              <Bell className="w-5 h-5 text-slate-500 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-600/50 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                  </button>
                </div>
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
                  {notificationsLoading ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">Loading...</div>
                  ) : notificationsError ? (
                    <div className="text-xs text-red-500 dark:text-red-400">Failed to load notifications</div>
                  ) : notifications && notifications.length ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-sm dark:shadow-lg ${
                              n.level === 'error'
                                ? 'bg-red-500 dark:shadow-red-500/50'
                                : n.level === 'warning'
                                ? 'bg-yellow-500 dark:shadow-yellow-500/50'
                                : 'bg-blue-500 dark:shadow-blue-500/50'
                            }`}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{n.message}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{n.ago}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">No new notifications.</div>
                  )}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-700/50 text-center bg-slate-50 dark:bg-slate-900/20 rounded-b-xl">
                  <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">View all notifications</button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSettings(!showSettings)
                setShowNotifications(false)
                setShowUserMenu(false)
              }}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors group"
            >
              <Settings className="w-5 h-5 text-slate-500 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-600/50 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Settings</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Spend Display</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSpendDisplayMode('credits')}
                        className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                          spendDisplayMode === 'credits'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 dark:shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                            : 'border-slate-200 dark:border-slate-600/50 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        Credits
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpendDisplayMode('usd')}
                        className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                          spendDisplayMode === 'usd'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 dark:shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                            : 'border-slate-200 dark:border-slate-600/50 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        USD
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 mt-3">USD per credit</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={usdRateDraft}
                        onChange={(e) => setUsdRateDraft(e.target.value)}
                        onBlur={() => setUsdPerCredit(Number(usdRateDraft))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600/50 bg-white dark:bg-slate-900/50 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500/70 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current conversion used when USD mode is selected.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 mb-2 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-500 focus:ring-blue-500/50 dark:focus:ring-offset-slate-800" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">Enable Notifications</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-500 focus:ring-blue-500/50 dark:focus:ring-offset-slate-800" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">Email Alerts</span>
                    </label>
                  </div>
                  
                  <hr className="border-slate-200 dark:border-slate-700/50" />
                  
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-2">Updates</p>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="updates" defaultChecked className="w-4 h-4 text-blue-600 dark:text-blue-500 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-blue-500/50 dark:focus:ring-offset-slate-800" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">Auto-update</span>
                    </label>
                    <label className="flex items-center gap-3 mt-2 cursor-pointer group">
                      <input type="radio" name="updates" className="w-4 h-4 text-blue-600 dark:text-blue-500 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:ring-blue-500/50 dark:focus:ring-offset-slate-800" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">Manual update</span>
                    </label>
                  </div>
                  
                  <hr className="border-slate-200 dark:border-slate-700/50" />
                  
                  <div className="space-y-1">
                    <a href="#" className="block px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors">System Settings</a>
                    <a href="#" className="block px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors">API Configuration</a>
                    <a href="#" className="block px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors">Help & Docs</a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowNotifications(false)
                setShowSettings(false)
              }}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md dark:shadow-lg dark:shadow-blue-500/20 border border-blue-400/20 group-hover:scale-105 transition-transform">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">User</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-600/50 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 mb-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Admin User</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">admin@lighthouse.dev</p>
                </div>
                <a href="#" className="block px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-colors">Profile</a>
                <a href="#" className="block px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-colors">Preferences</a>
                <hr className="my-1 border-slate-200 dark:border-slate-700/50" />
                <a href="#" className="block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 transition-colors">Logout</a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-6 py-1.5 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700/30 text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 flex items-center justify-between transition-colors duration-300">
        <span>Last updated: {refreshError ? '-' : (refreshStatus?.formatted || 'Loading...')}</span>
        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Connected to Snowflake
        </span>
      </div>

      {/* CMDK Command Palette Dialog */}
      <Command.Dialog 
        open={cmdkOpen} 
        onOpenChange={setCmdkOpen}
        className="fixed inset-0 z-[100] flex pt-[15vh] justify-center bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm"
      >
        <div className="w-full max-w-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden flex flex-col h-max max-h-[60vh] animate-in fade-in zoom-in-95">
         <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <DialogDescription className="sr-only">Search the dashboard.</DialogDescription>
         
          <Command.Input 
            placeholder="Search dashboards, queries, warehouses..." 
            className="w-full px-4 py-4 bg-transparent border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none text-lg"
          />
          <Command.List className="overflow-y-auto p-2 scrollbar-hide">
            <Command.Empty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No results found.</Command.Empty>

            <Command.Group heading="Dashboards & Monitoring" className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Command.Item onSelect={() => runCommand(() => router.push('/'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Dashboard Overview</Command.Item>
              <Command.Item onSelect={() => runCommand(() => router.push('/queries'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Active Queries</Command.Item>
              <Command.Item onSelect={() => runCommand(() => router.push('/warehouses'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Warehouse Credits</Command.Item>
              <Command.Item onSelect={() => runCommand(() => router.push('/storage'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Storage Analysis</Command.Item>
            </Command.Group>

            <Command.Group heading="Optimization & Security" className="px-2 py-1 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Command.Item onSelect={() => runCommand(() => router.push('/performance'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Performance Metrics</Command.Item>
              <Command.Item onSelect={() => runCommand(() => router.push('/recommendations'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Cortex AI Recommendations</Command.Item>
              <Command.Item onSelect={() => runCommand(() => router.push('/identity'))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Identity & Access Risk</Command.Item>
            </Command.Group>
            
            <Command.Group heading="Settings" className="px-2 py-1 mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Command.Item onSelect={() => runCommand(() => setShowSettings(true))} className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-blue-600 aria-selected:bg-blue-50 dark:aria-selected:bg-blue-600 aria-selected:text-blue-700 dark:aria-selected:text-white">Toggle Spend Display (USD/Credits)</Command.Item>
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>
    </header>
  )
}