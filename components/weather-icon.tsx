"use client"

import { motion } from 'framer-motion'
import { 
  Sun, 
  CloudSun, 
  Cloud, 
  CloudRain, 
  CloudDrizzle, 
  CloudLightning, 
  CloudSnow,
  Wind
} from 'lucide-react'
import type { WeatherConditionType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface WeatherIconProps {
  condition: WeatherConditionType
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
  className?: string
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

export function WeatherIcon({ 
  condition, 
  size = 'md', 
  animated = true,
  className 
}: WeatherIconProps) {
  const iconSize = sizeMap[size]
  
  const iconProps = {
    size: iconSize,
    className: cn('text-foreground', className),
  }

  switch (condition) {
    case 'clear':
      return (
        <motion.div
          animate={animated ? { rotate: 360 } : undefined}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="relative"
        >
          <Sun {...iconProps} className={cn(iconProps.className, 'text-amber-400')} />
          {animated && (
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ 
                background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
                width: iconSize * 2,
                height: iconSize * 2,
                top: -iconSize / 2,
                left: -iconSize / 2,
              }}
            />
          )}
        </motion.div>
      )
    
    case 'partly-cloudy':
      return (
        <motion.div className="relative">
          <CloudSun {...iconProps} className={cn(iconProps.className, 'text-amber-300')} />
          {animated && (
            <motion.div
              animate={{ x: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              <Cloud size={iconSize * 0.5} className="text-muted-foreground/50 absolute -top-1 -right-1" />
            </motion.div>
          )}
        </motion.div>
      )
    
    case 'cloudy':
      return (
        <motion.div
          animate={animated ? { x: [-3, 3, -3] } : undefined}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Cloud {...iconProps} className={cn(iconProps.className, 'text-muted-foreground')} />
        </motion.div>
      )
    
    case 'rain':
      return (
        <div className="relative">
          <CloudRain {...iconProps} className={cn(iconProps.className, 'text-blue-400')} />
          {animated && (
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-0.5 h-2 bg-blue-400/60 rounded-full"
                  style={{ left: `${30 + i * 25}%` }}
                  animate={{ 
                    y: [iconSize * 0.5, iconSize * 1.5],
                    opacity: [1, 0]
                  }}
                  transition={{ 
                    duration: 0.6, 
                    repeat: Infinity, 
                    delay: i * 0.2,
                    ease: 'easeIn'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )
    
    case 'drizzle':
      return (
        <div className="relative">
          <CloudDrizzle {...iconProps} className={cn(iconProps.className, 'text-blue-300')} />
          {animated && (
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(2)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-0.5 h-1 bg-blue-300/40 rounded-full"
                  style={{ left: `${35 + i * 30}%` }}
                  animate={{ 
                    y: [iconSize * 0.5, iconSize * 1.2],
                    opacity: [0.8, 0]
                  }}
                  transition={{ 
                    duration: 0.8, 
                    repeat: Infinity, 
                    delay: i * 0.3,
                    ease: 'easeIn'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )
    
    case 'storm':
      return (
        <motion.div
          animate={animated ? { scale: [1, 1.05, 1] } : undefined}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <CloudLightning {...iconProps} className={cn(iconProps.className, 'text-yellow-400')} />
        </motion.div>
      )
    
    case 'snow':
      return (
        <div className="relative">
          <CloudSnow {...iconProps} className={cn(iconProps.className, 'text-sky-200')} />
          {animated && (
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-sky-200 rounded-full"
                  style={{ left: `${25 + i * 25}%` }}
                  animate={{ 
                    y: [iconSize * 0.5, iconSize * 1.5],
                    x: [0, (i % 2 === 0 ? 3 : -3)],
                    opacity: [1, 0]
                  }}
                  transition={{ 
                    duration: 1.2, 
                    repeat: Infinity, 
                    delay: i * 0.3,
                    ease: 'easeIn'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )
    
    default:
      return <Wind {...iconProps} />
  }
}
