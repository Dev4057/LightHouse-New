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
    <div className="app-container flex h-screen overflow-hidden">
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
className="flex-1 flex flex-col min-w-0 overflow-x-hidden h-screen"      >
        {/* CORRECTED HEADER PROPS */}
        <Header 
          onMenuClick={handleMenuClick} 
          isSidebarOpen={isSidebarEffectivelyOpen} 
        />
        
        <main className="flex-1 overflow-auto relative">
          <div className="transition-opacity duration-300 ease-in-out animate-fadeIn">
            <div className="p-6">
              {children}
            </div>
          </div>
        </main>
      </motion.div>
    </div>
  )
}