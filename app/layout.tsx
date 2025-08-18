  import type React from "react"
  import type { Metadata } from "next"
  import Script from "next/script"
  import { Toaster } from "./components/Toaster"
  import { AppSidebar } from "./components/AppSidebar"
  import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"

  export const metadata: Metadata = {
  title: "Bodhium Workflow - AI-Powered Brand Analysis",
  description: "Automate brand analysis with AI-powered insights. Submit URLs, select products, generate queries, and get comprehensive results.",
  keywords: ["AI", "brand analysis", "workflow automation", "data scraping", "business intelligence"],
  authors: [{ name: "Bodhium" }],
  creator: "Bodhium",
  publisher: "Bodhium",
  viewport: "width=device-width, initial-scale=1",
}

  export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode
  }>) {
      return (
    <html lang="en">
      <head>
      <link rel="stylesheet" href="/tailwind.css" />
      </head>
      <body className="text-foreground">
        {/* Background */}
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[hsl(var(--primary))]/20 via-white to-white dark:from-[hsl(var(--primary))]/25 dark:via-slate-900 dark:to-slate-950">
          {/* Decorative gradients - behind everything */}
          <div className="pointer-events-none absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.04),_transparent_60%)] blur-2xl z-0" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(34,197,94,0.22),_transparent_60%)] blur-3xl z-0" />

          {/* App shell */}
          <SidebarProvider>
            <AppSidebar />
            <main className="relative z-10 flex-1 overflow-auto">
              {/* Content container with subtle padding so glass surfaces breathe */}
              <div className="px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </SidebarProvider>
        </div>
        <Toaster /> 
      </body>
    </html>
  )
  }
