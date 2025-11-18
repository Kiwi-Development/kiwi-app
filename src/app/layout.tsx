import type React from "react"
import type { Metadata } from "next"
import localFont from "next/font/local"
import "../../styles/globals.css"

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
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
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
        <main>{children}</main>
      </body>
    </html>
  )
}
