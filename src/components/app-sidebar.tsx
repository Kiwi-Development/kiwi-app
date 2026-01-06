"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Target, Users, Settings } from "lucide-react";
import Image from "next/image";

interface AppSidebarProps {
  onNavClick?: () => void;
}

export function AppSidebar({ onNavClick }: AppSidebarProps) {
  const pathname = usePathname();

  const navLinks = [
    {
      href: "/dashboard/tests",
      label: "Tests",
      icon: Target,
    },
    {
      href: "/dashboard/personas",
      label: "Personas",
      icon: Users,
    },
    {
      href: "/dashboard/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <div className="h-full w-full flex flex-col border-r border-border bg-sidebar/95 text-sidebar-foreground">
      <div className="flex h-20 items-center pl-4">
        <Link
          href="/dashboard/tests"
          className="flex items-center justify-start"
          onClick={onNavClick}
        >
          <Image
            src="/kiwilogo.png"
            alt="Kiwi Logo"
            width={90}
            height={90}
            className="h-12 w-auto"
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all group",
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
            >
              <link.icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="truncate transition-transform duration-200 group-hover:translate-x-1">
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
