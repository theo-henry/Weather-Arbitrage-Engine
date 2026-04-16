"use client"

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface ScoreChipProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'filled' | 'outline'
  showDelta?: boolean
  deltaValue?: number
  className?: string
}

function getScoreColor(score: number): { bg: string; text: string; border: string } {
  if (score >= 80) return { 
    bg: 'bg-green-500/10', 
    text: 'text-green-500', 
    border: 'border-green-500/30' 
  }
  if (score >= 60) return { 
    bg: 'bg-lime-500/10', 
    text: 'text-lime-500', 
    border: 'border-lime-500/30' 
  }
  if (score >= 40) return { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-500', 
    border: 'border-amber-500/30' 
  }
  return { 
    bg: 'bg-red-500/10', 
    text: 'text-red-500', 
    border: 'border-red-500/30' 
  }
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

export function ScoreChip({ 
  score, 
  size = 'md',
  variant = 'filled',
  showDelta = false,
  deltaValue,
  className 
}: ScoreChipProps) {
  const colors = getScoreColor(score)
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums',
        sizeClasses[size],
        variant === 'filled' ? colors.bg : 'bg-transparent border',
        variant === 'outline' && colors.border,
        colors.text,
        className
      )}
    >
      <span>{score}</span>
      {showDelta && deltaValue !== undefined && (
        <span className={cn(
          'text-xs',
          deltaValue > 0 ? 'text-green-500' : deltaValue < 0 ? 'text-red-500' : 'text-muted-foreground'
        )}>
          {deltaValue > 0 ? '+' : ''}{deltaValue}
        </span>
      )}
    </motion.div>
  )
}

interface DeltaChipProps {
  value: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function DeltaChip({ value, label, size = 'md', className }: DeltaChipProps) {
  const isPositive = value > 0
  const isNeutral = value === 0
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium tabular-nums',
        sizeClasses[size],
        isPositive 
          ? 'bg-green-500/10 text-green-500' 
          : isNeutral 
            ? 'bg-muted text-muted-foreground'
            : 'bg-red-500/10 text-red-500',
        className
      )}
    >
      <span>
        {isPositive ? '+' : ''}{value}
        {label && ` ${label}`}
      </span>
    </motion.div>
  )
}
