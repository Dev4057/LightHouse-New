'use client'

import { RadioTower, Database, Sparkles, Loader2 } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

const LOADING_STEPS = [
  { text: 'Connecting to Snowflake...', icon: Database },
  { text: 'Querying system tables...', icon: Loader2 },
  { text: 'Analyzing performance metrics...', icon: RadioTower },
  { text: 'Generating Cortex AI insights...', icon: Sparkles },
]

function Particle({ delay, size, x, y, duration }: { delay: number; size: number; x: number; y: number; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-blue-500/30 dark:bg-blue-400/30"
      style={{ width: size, height: size }}
      initial={{ x, y, opacity: 0, scale: 0 }}
      animate={{
        x: [x, x + (Math.random() - 0.5) * 200],
        y: [y, y - 150 - Math.random() * 200],
        opacity: [0, 0.8, 0],
        scale: [0, 1, 0.3],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  )
}

function OrbitalRing({ radius, duration, dotCount, color }: { radius: number; duration: number; dotCount: number; color: string }) {
  return (
    <motion.div
      className="absolute"
      style={{ width: radius * 2, height: radius * 2 }}
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    >
      {Array.from({ length: dotCount }).map((_, i) => {
        const angle = (i / dotCount) * Math.PI * 2
        const x = Math.cos(angle) * radius + radius
        const y = Math.sin(angle) * radius + radius
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4,
              height: 4,
              left: x - 2,
              top: y - 2,
              backgroundColor: color,
            }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
          />
        )
      })}
    </motion.div>
  )
}

export default function LighthouseLoader() {
  const [stepIndex, setStepIndex] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Wait until mounted to use Portals (prevents Next.js hydration errors)
  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  const particles = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        delay: Math.random() * 5,
        size: 2 + Math.random() * 4,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 200 + 100,
        duration: 3 + Math.random() * 3,
      })),
    []
  )

  const currentStep = LOADING_STEPS[stepIndex]
  const StepIcon = currentStep.icon

  // The actual full-screen loader layout
  const loaderContent = (
    // ✨ z-[99999] guarantees it sits on top of absolutely everything
    // ✨ bg-[#05070a] gives it that ultra-dark premium cinematic look
    <div className="fixed inset-0 z-[99999] flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#05070a] transition-colors duration-500">
      
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="absolute h-[400px] w-[400px] rounded-full bg-blue-500/15 dark:bg-blue-500/10 blur-[100px]"
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute h-[300px] w-[300px] rounded-full bg-purple-500/15 dark:bg-purple-500/10 blur-[80px]"
          animate={{ scale: [1.1, 1, 1.1], x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Main content */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        {/* Central icon assembly */}
        <div className="relative flex items-center justify-center mt-10">
          
          {/* Beacon pulses */}
          <motion.div
            className="absolute h-32 w-32 rounded-full border border-blue-500/30"
            animate={{ scale: [0.8, 2.5], opacity: [0.6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute h-32 w-32 rounded-full border border-blue-500/20"
            animate={{ scale: [0.8, 2.5], opacity: [0.4, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
          />
          <motion.div
            className="absolute h-32 w-32 rounded-full border border-purple-500/20"
            animate={{ scale: [0.8, 2.5], opacity: [0.3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 1.6 }}
          />

          {/* Orbital rings */}
          <div className="absolute flex items-center justify-center">
            <OrbitalRing radius={90} duration={12} dotCount={8} color="#3b82f6" />
          </div>
          <div className="absolute flex items-center justify-center">
            <OrbitalRing radius={120} duration={18} dotCount={12} color="#8b5cf6" />
          </div>

          {/* Spinning outer ring */}
          <motion.div
            className="absolute h-40 w-40 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent, rgba(59,130,246,0.3), transparent, rgba(139,92,246,0.3), transparent)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />

          {/* Glassmorphism container */}
          <motion.div
            className="relative z-10 flex h-28 w-28 items-center justify-center rounded-3xl border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60 shadow-2xl backdrop-blur-xl"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Inner glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
            <RadioTower className="relative z-10 h-12 w-12 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Brand text */}
        <div className="flex flex-col items-center gap-3">
          <motion.h1
            className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 dark:from-blue-400 dark:via-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
              Lighthouse
            </span>
          </motion.h1>
          <motion.p
            className="text-sm font-medium tracking-widest uppercase text-slate-500 dark:text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Snowflake Intelligence Platform
          </motion.p>
        </div>

        {/* Loading status */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {/* Progress bar */}
          <div className="h-[3px] w-64 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '50%' }}
            />
          </div>

          {/* Step text with icon */}
          <div className="flex items-center justify-center h-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepIndex}
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <StepIcon className="h-4 w-4 text-blue-500 dark:text-blue-400 animate-pulse" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{currentStep.text}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2">
            {LOADING_STEPS.map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full"
                animate={{
                  width: i === stepIndex ? 24 : 6,
                  backgroundColor: i === stepIndex ? '#3b82f6' : '#cbd5e1', 
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )

  // ✨ Using React Portal safely on the client side
  if (!mounted) return null
  return createPortal(loaderContent, document.body)
}