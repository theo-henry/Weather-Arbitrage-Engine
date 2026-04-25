"use client"

import { motion } from 'framer-motion'
import { 
  Dumbbell, 
  BookOpen, 
  Wine, 
  Plane, 
  Camera, 
  Settings 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity } from '@/lib/types'

interface ActivitySelectorProps {
  selected: Activity | null
  onSelect: (activity: Activity) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const activities: { id: Activity; label: string; icon: typeof Dumbbell }[] = [
  { id: 'run', label: 'Run', icon: Dumbbell },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'social', label: 'Social', icon: Wine },
  { id: 'flight', label: 'Flights', icon: Plane },
  { id: 'photo', label: 'Photo', icon: Camera },
  { id: 'custom', label: 'Custom', icon: Settings },
]

const sizeConfig = {
  sm: { icon: 16, padding: 'p-2', gap: 'gap-1', text: 'text-xs' },
  md: { icon: 20, padding: 'p-3', gap: 'gap-1.5', text: 'text-sm' },
  lg: { icon: 24, padding: 'p-4', gap: 'gap-2', text: 'text-base' },
}

export function ActivitySelector({ 
  selected, 
  onSelect, 
  size = 'md',
  className 
}: ActivitySelectorProps) {
  const config = sizeConfig[size]
  
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {activities.map((activity) => {
        const Icon = activity.icon
        const isSelected = selected === activity.id
        
        return (
          <motion.button
            key={activity.id}
            onClick={() => onSelect(activity.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'relative flex flex-col items-center rounded-xl border transition-all duration-200',
              config.padding,
              config.gap,
              isSelected
                ? 'border-transparent bg-gradient-to-br from-blue-500/20 via-violet-500/20 to-amber-500/20'
                : 'border-border/50 bg-card hover:border-border hover:bg-muted/50'
            )}
          >
            {isSelected && (
              <motion.div
                layoutId="activity-glow"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1), rgba(245, 158, 11, 0.1))',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <Icon 
              size={config.icon} 
              className={cn(
                'relative z-10 transition-colors',
                isSelected ? 'text-foreground' : 'text-muted-foreground'
              )} 
            />
            <span 
              className={cn(
                'relative z-10 font-medium transition-colors',
                config.text,
                isSelected ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {activity.label}
            </span>
            {isSelected && (
              <motion.div
                layoutId="activity-indicator"
                className="absolute -bottom-px left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
