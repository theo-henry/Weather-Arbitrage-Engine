"use client"

import Link from 'next/link'
import { Zap } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const footerLinks = {
  product: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/scheduler', label: 'Scheduler' },
    { href: '/compare', label: 'Compare' },
  ],
  resources: [
    { href: '/about', label: 'How It Works' },
    { href: '#', label: 'API Docs' },
    { href: '#', label: 'Changelog' },
  ],
  legal: [
    { href: '#', label: 'Privacy' },
    { href: '#', label: 'Terms' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 rounded-lg blur-sm opacity-75" />
                <div className="relative bg-background rounded-lg p-1.5">
                  <Zap className="h-5 w-5 text-foreground" />
                </div>
              </div>
              <span className="font-semibold">Weather Scheduler</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Find the best time to act — not just the weather.
            </p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Made for hackathon demos. Not a real weather service.
          </p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Built with</span>
            <span className="edge-gradient-text font-medium">passion</span>
            <span>and weather data</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
