import { Button } from "../../components/ui/button"
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold mb-6">Welcome to Kiwi</h1>
        <p className="text-2xl text-muted-foreground mb-8">
          AI-Native Usability Testing Platform
        </p>
        <Button asChild size="lg">
          <Link href="/tests">Get Started</Link>
        </Button>
      </div>
    </main>
  )
}