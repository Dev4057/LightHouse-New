'use client'

import { ReactNode, useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="app-container flex h-screen">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto">
          <div className="transition-opacity duration-300 ease-in-out animate-fadeIn">
            <div className="p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
