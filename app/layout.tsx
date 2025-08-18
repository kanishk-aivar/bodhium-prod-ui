  import type React from "react"
  import type { Metadata } from "next"
  import Script from "next/script"
  import { Toaster } from "./components/Toaster"

  export const metadata: Metadata = {
    title: "v0 App",
    description: "Created with v0",
    generator: "v0.dev",
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
        <body>
            {children}
          <Toaster /> 
        </body>
      </html>
    )
  }
