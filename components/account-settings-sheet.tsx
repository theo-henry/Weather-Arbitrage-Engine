'use client'

import { Settings2 } from 'lucide-react'
import { PreferencePanel } from '@/components/preference-panel'
import { SchedulingRulesPanel } from '@/components/scheduling-rules-panel'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePreferences } from '@/hooks/use-preferences'

interface AccountSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail?: string | null
}

export function AccountSettingsSheet({
  open,
  onOpenChange,
  userEmail,
}: AccountSettingsSheetProps) {
  const [preferences, setPreferences] = usePreferences()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/50 bg-card/80 pr-12 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-amber-500/10 p-2.5">
              <Settings2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle>Account Settings</SheetTitle>
              <SheetDescription className="mt-1">
                {userEmail ? `Signed in as ${userEmail}. ` : ''}
                Weather-aware suggestions, scheduling rules, and chatbot settings all use this profile.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="preferences" className="min-h-0 flex-1 gap-0">
          <div className="border-b border-border/50 px-4 py-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="rules">Scheduling Rules</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="preferences" className="mt-0 p-4">
              <PreferencePanel
                preferences={preferences}
                onPreferencesChange={setPreferences}
                showFindEdge={false}
              />
            </TabsContent>

            <TabsContent value="rules" className="mt-0 p-4">
              <SchedulingRulesPanel preferences={preferences} onPreferencesChange={setPreferences} />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <SheetFooter className="border-t border-border/50">
          <form action="/auth/signout" method="post" className="w-full">
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
