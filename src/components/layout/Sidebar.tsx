'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Zap,
  Database,
  Shield,
  Settings,
  ChevronDown,
  TrendingUp,
  Package,
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: <BarChart3 className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Queries', href: '/queries', icon: <Zap className="w-5 h-5" /> },
      { label: 'Warehouses', href: '/warehouses', icon: <Database className="w-5 h-5" /> },
      { label: 'Storage', href: '/storage', icon: <Package className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Optimization',
    items: [
      { label: 'Performance', href: '/performance', icon: <TrendingUp className="w-5 h-5" /> },
      { label: 'Recommendations', href: '/recommendations', icon: <Settings className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Security',
    items: [
      { label: 'Identity & Access', href: '/identity', icon: <Shield className="w-5 h-5" /> },
    ],
  },
]

export default function Sidebar({ 
  isOpen, 
  isCollapsed, 
  onToggle 
}: { 
  isOpen: boolean; 
  isCollapsed: boolean; 
  onToggle: () => void 
}) {
  const pathname = usePathname()
  
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(navSections.map(s => s.title))
  )

  // 1. Add state for mobile detection
  const [isMobile, setIsMobile] = useState(false)

  // 2. Safely check window size only after component mounts in the browser
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile() // Check on initial load
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSection = (section: string) => {
    if (isCollapsed) return // Don't toggle if collapsed
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleNavClick = () => {
    if (isMobile) onToggle() // Uses the safe state
  }

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        layout
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 256,
          // 3. Use isMobile state instead of window.innerWidth
          x: isMobile ? (isOpen ? 0 : '-100%') : 0
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed z-40 h-screen glass border-r border-slate-700/50 flex flex-col left-0 top-0 overflow-hidden"
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-6 py-6 border-b border-slate-700/50 ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 whitespace-nowrap"
              >
                <h1 className="text-xl font-bold text-white tracking-tight">Lighthouse</h1>
                <p className="text-xs text-blue-400 font-medium">Snowflake Monitor</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-6 scrollbar-hide">
          {navSections.map((section) => (
            <div key={section.title} className="px-3">
              <button
                onClick={() => toggleSection(section.title)}
                className={`flex items-center w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors ${isCollapsed ? 'justify-center' : 'justify-between hover:text-slate-200'}`}
              >
                {!isCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{section.title}</motion.span>}
                {!isCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedSections.has(section.title) ? 'rotate-180' : ''}`} />
                )}
                {isCollapsed && <span className="block w-4 border-b border-slate-600 rounded"></span>}
              </button>

              <AnimatePresence>
                {(expandedSections.has(section.title) || isCollapsed) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 space-y-1 overflow-hidden"
                  >
                    {section.items.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={handleNavClick}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                            isActive
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                          } ${isCollapsed ? 'justify-center' : ''}`}
                        >
                          <div className={isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200 transition-colors'}>
                            {item.icon}
                          </div>
                          {!isCollapsed && (
                            <span className="flex-1 text-sm font-medium whitespace-nowrap">{item.label}</span>
                          )}
                          {!isCollapsed && item.badge && (
                            <span className="px-2 py-0.5 bg-blue-900/50 border border-blue-700/50 text-blue-200 text-[10px] uppercase font-bold tracking-wider rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 flex justify-center">
          {!isCollapsed ? (
            <p className="text-xs text-slate-500 font-medium">v0.1.0 Beta</p>
          ) : (
            <div className="w-2 h-2 rounded-full bg-blue-500/50"></div>
          )}
        </div>
      </motion.aside>
    </>
  )
}