"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "../../../../../components/ui/button"
import { ChevronDown } from "lucide-react"

interface LogEntry {
  t: number
  text: string
}

interface LiveLogProps {
  logs: LogEntry[]
  startTime?: number
}

export function LiveLog({ logs, startTime = Date.now() }: LiveLogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10
    setAutoScroll(isAtBottom)
  }

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      setAutoScroll(true)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto pr-2"
        onScroll={handleScroll}
      >
        {logs.map((log, index) => (
          <div
            key={index}
            className="p-2 rounded bg-muted/50 text-muted-foreground flex gap-3"
            data-testid={`log-line-${index}`}
          >
            <span className="text-xs text-muted-foreground/70 shrink-0">{formatTime(log.t)}</span>
            <span className="flex-1">{log.text}</span>
          </div>
        ))}
      </div>

      {!autoScroll && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
          <Button size="sm" variant="secondary" onClick={scrollToBottom} className="shadow-lg">
            <ChevronDown className="h-4 w-4 mr-2" />
            Jump to Live
          </Button>
        </div>
      )}
    </div>
  )
}
