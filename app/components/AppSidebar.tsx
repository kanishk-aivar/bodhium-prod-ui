"use client"

import { Home, Package, MessageSquare, BarChart, FileSpreadsheet } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "./ThemeToggle"

const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
    description: "Submit URLs & History"
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
    description: "Browse Database"
  },
  {
    title: "Queries",
    url: "/queries", 
    icon: MessageSquare,
    description: "Select & Create"
  },
  {
    title: "Results",
    url: "/results",
    icon: BarChart,
    description: "View Analysis"
  },
  {
    title: "Ad-hoc Jobs",
    url: "/adhoc",
    icon: FileSpreadsheet,
    description: "Download CSV Results"
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="fixed left-0 top-0 z-50 h-screen">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground">
            <BarChart className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold bg-gradient-to-r from-[hsl(var(--foreground))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              Bodhium
            </span>
            <span className="text-xs text-muted-foreground">AI Brand Analysis</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url} className="flex items-center gap-2 w-full">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-1">
              <ThemeToggle />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto p-2">
        {/* Footer content if needed */}
      </SidebarFooter>
    </Sidebar>
  )
}
