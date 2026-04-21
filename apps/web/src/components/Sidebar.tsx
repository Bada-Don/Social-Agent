"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  BrainCircuit,
  Contact,
  Settings,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Unified Inbox", href: "/inbox", icon: Inbox },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Ask AI", href: "/ai", icon: BrainCircuit },
    { name: "Memory", href: "/memory", icon: Contact },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen border-r border-white/10 bg-surface p-4 flex flex-col gap-2">
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          EA
        </div>
        <span className="font-semibold tracking-wide text-gray-200">
          Executive OS
        </span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon size={18} />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
