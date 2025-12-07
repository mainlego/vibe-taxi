'use client'

import { useRef, useState, useEffect, ReactNode, useCallback } from 'react'
import { motion, useMotionValue, PanInfo, useAnimation } from 'framer-motion'
import { clsx } from 'clsx'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface BottomSheetProps {
  children: ReactNode
  isOpen?: boolean
  onClose?: () => void
  snapPoints?: number[] // Heights in vh (e.g., [30, 60, 90])
  defaultSnapPoint?: number // Index of default snap point
  showHandle?: boolean
  showExpandButton?: boolean
  className?: string
}

export function BottomSheet({
  children,
  isOpen = true,
  onClose,
  snapPoints = [40, 70, 90],
  defaultSnapPoint = 0,
  showHandle = true,
  showExpandButton = true,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800)
  const [currentSnapIndex, setCurrentSnapIndex] = useState(defaultSnapPoint)
  const [isContentScrolled, setIsContentScrolled] = useState(false)

  const controls = useAnimation()
  const y = useMotionValue(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setWindowHeight(window.innerHeight)
    const handleResize = () => setWindowHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate actual heights in pixels
  const snapHeights = snapPoints.map(vhHeight => (windowHeight * vhHeight) / 100)
  const minHeight = snapHeights[0]
  const maxHeight = snapHeights[snapHeights.length - 1]

  // Current target height
  const currentHeight = snapHeights[currentSnapIndex] || minHeight

  // Track content scroll position
  const handleContentScroll = useCallback(() => {
    const content = contentRef.current
    if (content) {
      setIsContentScrolled(content.scrollTop > 0)
    }
  }, [])

  const snapToIndex = useCallback((index: number) => {
    setCurrentSnapIndex(index)
    y.set(0)
    controls.start({ height: snapHeights[index] })
  }, [controls, snapHeights, y])

  const handleDragEnd = (_: any, info: PanInfo) => {
    const velocity = info.velocity.y
    const offset = info.offset.y

    // Calculate projected position based on velocity
    const projectedOffset = offset + velocity * 0.2

    // Determine direction and find target snap point
    let targetIndex = currentSnapIndex

    if (projectedOffset < -50) {
      // Dragging up - expand
      targetIndex = Math.min(currentSnapIndex + 1, snapHeights.length - 1)
    } else if (projectedOffset > 50) {
      // Dragging down - collapse
      targetIndex = Math.max(currentSnapIndex - 1, 0)
    }

    // If dragged down past minimum significantly, close
    if (projectedOffset > minHeight * 0.6 && onClose) {
      onClose()
      return
    }

    snapToIndex(targetIndex)
  }

  const toggleExpand = () => {
    if (currentSnapIndex < snapHeights.length - 1) {
      snapToIndex(currentSnapIndex + 1)
    } else {
      snapToIndex(0)
    }
  }

  if (!isOpen) return null

  const isExpanded = currentSnapIndex === snapHeights.length - 1

  return (
    <motion.div
      ref={sheetRef}
      initial={{ y: '100%', height: currentHeight }}
      animate={{ y: 0, height: currentHeight }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={clsx(
        'fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 flex flex-col',
        className
      )}
    >
      {/* Drag Handle Area - only this part is draggable */}
      <motion.div
        ref={handleRef}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        {showHandle && (
          <div className="py-3 flex flex-col items-center">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            {showExpandButton && (
              <button
                onClick={toggleExpand}
                className="mt-1 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Snap point indicators */}
      {snapPoints.length > 1 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
          {snapPoints.map((_, index) => (
            <button
              key={index}
              onClick={() => snapToIndex(index)}
              className={clsx(
                'w-2 h-2 rounded-full transition-all',
                currentSnapIndex === index
                  ? 'bg-primary-500 scale-125'
                  : 'bg-gray-300 hover:bg-gray-400'
              )}
            />
          ))}
        </div>
      )}

      {/* Scrollable Content */}
      <div
        ref={contentRef}
        onScroll={handleContentScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <div className="px-6 pb-6">
          {children}
        </div>
      </div>

      {/* Safe area padding for iOS */}
      <div className="flex-shrink-0 pb-safe" />
    </motion.div>
  )
}

// Simple animated sheet without dragging (for static content)
export function SimpleBottomSheet({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={clsx(
        'fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-40',
        className
      )}
    >
      {children}
      <div className="pb-safe" />
    </motion.div>
  )
}

// Draggable sheet optimized for order flow
export function OrderBottomSheet({
  children,
  onExpand,
  onCollapse,
  defaultExpanded = false,
  className,
}: {
  children: ReactNode
  onExpand?: () => void
  onCollapse?: () => void
  defaultExpanded?: boolean
  className?: string
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const contentRef = useRef<HTMLDivElement>(null)
  const y = useMotionValue(0)

  const handleDragEnd = (_: any, info: PanInfo) => {
    const velocity = info.velocity.y
    const offset = info.offset.y
    const projectedOffset = offset + velocity * 0.15

    if (projectedOffset < -30 && !isExpanded) {
      setIsExpanded(true)
      onExpand?.()
    } else if (projectedOffset > 30 && isExpanded) {
      setIsExpanded(false)
      onCollapse?.()
    }
    y.set(0)
  }

  const toggleExpand = () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    if (newExpanded) {
      onExpand?.()
    } else {
      onCollapse?.()
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{
        y: 0,
        height: isExpanded ? '85vh' : 'auto',
        maxHeight: isExpanded ? '85vh' : '50vh'
      }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={clsx(
        'fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 flex flex-col',
        className
      )}
    >
      {/* Draggable Handle */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <button
          onClick={toggleExpand}
          className="w-full py-3 flex flex-col items-center"
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            {isExpanded ? (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Свернуть</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Развернуть</span>
              </>
            )}
          </div>
        </button>
      </motion.div>

      {/* Scrollable Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>

      <div className="pb-safe" />
    </motion.div>
  )
}
