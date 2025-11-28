"use client"

import { ReactNode, useState } from "react"
import { AppSidebar } from "./app-sidebar"
import { Button } from "./ui/button"
import { Menu } from "lucide-react"

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50 print:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden print:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:hidden print:hidden`}
      >
        <div className="h-full bg-sidebar text-sidebar-foreground">
          <AppSidebar onNavClick={() => setMobileMenuOpen(false)} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex print:hidden">
        <AppSidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto print:overflow-visible print:h-auto">
        <div className="h-full p-6 print:p-0 print:h-auto">
          {children}
        </div>
      </main>
    </div>
  )
}