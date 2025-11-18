"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { cn } from "../lib/utils"
import Image from "next/image"
import { Home, Target, Users, Settings } from "lucide-react"

export function AppSidebar() {
  const pathname = usePathname()

  const navLinks = [
    { 
      href: "/tests", 
      label: "Tests",
      icon: Target
    },
    { 
      href: "/personas", 
      label: "Personas",
      icon: Users
    },
    { 
      href: "/settings", 
      label: "Settings",
      icon: Settings
    },
  ]

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r border-border bg-background/95">
      <div className="flex h-20 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/kiwilogo.png"
            alt="Kiwi Logo"
            width={90}
            height={90}
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navLinks.map((link) => {
          const isActive = pathname?.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive 
                  ? "bg-accent text-accent-foreground" 
                  : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              <link.icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  JP
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">John Doe</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="right">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}