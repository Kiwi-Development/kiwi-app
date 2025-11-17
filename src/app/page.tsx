import { Button } from "../../components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold">Welcome to Kiwi</h1>
      </div>
      <div className="relative flex place-items-center">
        <div className="text-center">
          <p className="text-lg mb-8">
            AI-Native Usability Testing Platform
          </p>
          <Button>Get Started</Button>
        </div>
      </div>
    </main>
  )
}