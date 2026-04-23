'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AccountSettingsSheet } from '@/components/account-settings-sheet'
import { useUser } from '@/hooks/use-user'

export function UserMenu() {
  const { user } = useUser()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const initial = (user.email ?? '?').charAt(0).toUpperCase()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Open account settings"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-amber-500 text-xs font-semibold text-white">
          {initial}
        </span>
      </Button>

      <AccountSettingsSheet open={open} onOpenChange={setOpen} userEmail={user.email} />
    </>
  )
}
