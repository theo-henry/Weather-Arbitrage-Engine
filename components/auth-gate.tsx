'use client'

import { cloneElement, type ReactElement, type MouseEvent } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/hooks/use-user'

interface AuthGateProps {
  next?: string
  children: ReactElement<{ onClick?: (e: MouseEvent) => void }>
}

export function AuthGate({ next, children }: AuthGateProps) {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  return cloneElement(children, {
    onClick: (e: MouseEvent) => {
      if (!user) {
        e.preventDefault()
        const target = next ?? pathname
        router.push(`/signup?next=${encodeURIComponent(target)}`)
        return
      }
      children.props.onClick?.(e)
    },
  })
}
