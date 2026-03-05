'use client'

import { ReactNode, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen to adjust behavior
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleMenuClick = () => {
    if (isMobile) {
      setIsMobileOpen(!isMobileOpen)
    } else {
      setIsCollapsed(!isCollapsed)
    }
  }

  // Calculate if the sidebar is effectively "open" based on screen size
  const isSidebarEffectivelyOpen = isMobile ? isMobileOpen : !isCollapsed;

  return (
    // ✨ THE FIX: Added bg-slate-50 for light mode and dark:bg-[#0a0e1a] for dark mode 
    <div className="app-container flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0a0e1a] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar 
        isOpen={isMobileOpen} 
        isCollapsed={isCollapsed && !isMobile} 
        onToggle={() => setIsMobileOpen(!isMobileOpen)} 
      />
      
      <motion.div 
        layout
        initial={false}
        animate={{ 
          marginLeft: isMobile ? 0 : (isCollapsed ? 80 : 256) 
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 flex flex-col min-w-0 overflow-x-hidden h-screen"      
      >
        <Header 
          onMenuClick={handleMenuClick} 
          isSidebarOpen={isSidebarEffectivelyOpen} 
        />
        
        <main className="flex-1 overflow-auto relative">
          <div className="transition-opacity duration-300 ease-in-out animate-fadeIn">
            {/* ✨ Responsive padding added here for a cleaner look on all screens */}
            <div className="p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  )
}