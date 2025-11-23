import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import "../../styles/globals.css"
import { Toaster } from "sonner"
import { Providers } from './provider'

const satoshi = localFont({
  src: [
    {
      path: "../../public/fonts/Satoshi-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-satoshi",
})

export const metadata: Metadata = {
  title: "Kiwi - AI-Native Usability Testing",
  description: "Automated usability testing with AI-powered insights",
  generator: "v0.app",
  icons: {
    icon: '/favicon.ico',
    apple: "../../public/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${satoshi.variable} font-sans antialiased`}>
        <Providers>
          <main>{children}</main>
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}
