'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // ✨ Professional touch: Close the tooltip if the user clicks anywhere else on the screen
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    // Only attach the listener if the tooltip is actually open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative flex items-center" ref={tooltipRef}>
      {/* ── THE CLICKABLE BUTTON ── */}
      <button 
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation() // Prevents clicking this from triggering other parent clicks
          setIsOpen(!isOpen)
        }}
        className="focus:outline-none flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 p-1 transition-colors"
        aria-label="More information"
      >
        <HelpCircle className={`w-4 h-4 transition-colors ${isOpen ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} />
      </button>
      
      {/* ── THE POPUP BOX (Now controlled by React State) ── */}
      <div 
        className={`
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 
          bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 
          text-[13px] leading-relaxed rounded-lg shadow-xl z-[100]
          transition-all duration-200 origin-bottom
          ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
        `}
      >
        {text}
        
        {/* The tiny triangle pointing down */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800 dark:border-t-slate-100"></div>
      </div>
    </div>
  )
}