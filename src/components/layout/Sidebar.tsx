'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
import { useState } from 'react'

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
    title: 'Insights & Optimization',
    items: [
      { label: 'Performance', href: '/performance', icon: <TrendingUp className="w-5 h-5" /> },
      { label: 'Recommendations', href: '/recommendations', icon: <Settings className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Security & Access',
    items: [
      { label: 'Identity & Access', href: '/identity', icon: <Shield className="w-5 h-5" /> },
    ],
  },
]

export default function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const pathname = usePathname()
  
  // Initialize all sections as expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(navSections.map(s => s.title))
  )

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  // Close sidebar on route change (mobile only)
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onToggle()
    }
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:fixed z-40 w-64 h-screen bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 transition-transform duration-300 ease-out overflow-y-auto flex flex-col left-0 top-0`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">Lighthouse</h1>
              <p className="text-xs text-slate-400">Snowflake Monitor</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
              >
                {section.title}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    expandedSections.has(section.title) ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.has(section.title) && (
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleNavClick}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                            : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        {item.icon}
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 bg-green-900/50 text-green-200 text-xs rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 text-center">v0.1.0 Beta</p>
        </div>
      </aside>
    </>
  )
}
