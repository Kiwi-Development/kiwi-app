"use client"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { CalProvider, CalButton } from "../components/Cal"
import { LoginModal } from "@/components/auth/LoginModal"
import { SignUpModal } from "@/components/auth/SignUpModal"
import { MousePointer2 } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { useState } from "react"

function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) throw new Error("Failed to join")

      toast.success("You've been added to the waitlist!")
      setEmail("")
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md relative mb-12">
      <Input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-14 pl-6 pr-36 rounded-full border-gray-200 shadow-sm text-base bg-white focus-visible:ring-[#F34822]"
      />
      <Button
        type="submit"
        disabled={loading}
        className="absolute right-1.5 top-1.5 bottom-1.5 bg-[#F34822] hover:bg-[#F34822]/90 text-white rounded-full px-6 h-auto font-medium disabled:opacity-50"
      >
        {loading ? "Joining..." : "Join Waitlist"}
      </Button>
    </form>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/kiwilogo.png"
        alt="Kiwi Logo"
        width={0}
        height={0}
        sizes="70vw"
        className="w-full h-auto"
      />
    </div>
  )
}

function Cursor({
  text,
  color = "bg-[#F34822]",
  className,
  flipped = false,
}: {
  text: string
  color?: string
  className?: string
  flipped?: boolean
}) {
  return (
    <div className={`absolute flex items-start gap-2 ${className} pointer-events-none z-20`}>
      <MousePointer2
        className={`h-5 w-5 ${flipped ? "-scale-x-100" : ""} fill-black text-black`}
      />
      <div
        className={`${color} text-white px-3 py-1.5 rounded-full rounded-tl-none text-sm font-medium shadow-lg ${flipped ? "rounded-tr-none rounded-tl-full" : ""
          }`}
      >
        {text}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <CalProvider>
      <div className="min-h-screen bg-white p-6">
        <main className="min-h-[calc(100vh-3rem)] bg-background bg-grid-pattern relative overflow-hidden font-sans rounded-[2rem] shadow-2xl">
          {/* Header */}
          <header className="flex justify-between items-center p-6 max-w-7xl mx-auto w-full relative z-10">
            <Logo />
            <div className="flex items-center gap-4">
              <CalButton
                calLink="ilyssa-yan-q9leex/15min"
                config={{ layout: "month_view" }}
                className="bg-[#F34822] hover:bg-[#F34822]/90 text-white rounded-full px-6 font-medium h-10 py-2"
              >
                Book a Demo
              </CalButton>
              <LoginModal>
                <Button variant="ghost" className="rounded-full font-medium text-base px-6">
                  Log in
                </Button>
              </LoginModal>
            </div>
          </header>

          {/* Hero Section */}
          <div className="flex flex-col items-center justify-center pt-12 pb-24 px-4 text-center relative max-w-5xl mx-auto z-10">
            <Badge variant="secondary" className="mb-8 px-4 py-1.5 rounded-full text-sm font-normal bg-white border shadow-sm hover:bg-white">
              Coming Soon
            </Badge>

            <h1 className="text-5xl md:text-7xl font-serif tracking-tight text-foreground mb-8 leading-[1.1]">
              Get Feedback on Designs
              <br />
              in <span className="text-[#F34822] italic">Minutes</span>, Not Weeks
            </h1>

            {/* Email Input */}
            <WaitlistForm />

            {/* Social Proof */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                <Avatar className="border-2 border-white w-8 h-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
                <Avatar className="border-2 border-white w-8 h-8">
                  <AvatarImage src="https://github.com/vercel.png" />
                  <AvatarFallback>VC</AvatarFallback>
                </Avatar>
                <Avatar className="border-2 border-white w-8 h-8">
                  <AvatarImage src="https://github.com/nextjs.png" />
                  <AvatarFallback>NX</AvatarFallback>
                </Avatar>
              </div>
              <p>20+ designers have already joined</p>
            </div>

            {/* Floating Cursors */}
            <Cursor
              text="Say something"
              className="bottom-20 right-10 md:right-20 hidden md:flex"
            />
          </div>

          {/* Dashboard Preview */}
          <div className="max-w-6xl mx-auto px-4 relative z-10">
            <div className="rounded-xl border bg-white shadow-2xl overflow-hidden p-2">
              <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                <Image
                  src="/dashboard_hero.png"
                  alt="Dashboard Preview"
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Gradient Overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent pointer-events-none z-0"></div>
        </main>
        <SignUpModal />
      </div>
    </CalProvider>
  )
}