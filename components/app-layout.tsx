"use client"

import { ReactNode } from "react"
import { AppSidebar } from "./app-sidebar"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}