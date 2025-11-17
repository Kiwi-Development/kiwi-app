"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import type { LiveRunState, RunEvent, PersonaProgress, RunStatus } from "./model"
import type { LiveRunAdapter } from "./adapter"

interface LiveRunControls {
  seek: (seconds: number) => void
  setRate: (rate: number) => void
  togglePlay: () => void
  copyTimestamp: () => void
  highlightEvent: (eventId: string) => void
}

interface LiveRunContextValue {
  state: LiveRunState
  controls: LiveRunControls
}

const LiveRunContext = createContext<LiveRunContextValue | null>(null)

export function useLiveRun() {
  const context = useContext(LiveRunContext)
  if (!context) {
    throw new Error("useLiveRun must be used within LiveRunProvider")
  }
  return context
}

interface LiveRunProviderProps {
  children: ReactNode
  adapter: LiveRunAdapter
  initialState: LiveRunState
  videoRef?: React.RefObject<HTMLVideoElement>
}

export function LiveRunProvider({ children, adapter, initialState, videoRef }: LiveRunProviderProps) {
  const [state, setState] = useState<LiveRunState>(initialState)
  const [highlightedEventId, setHighlightedEventId] = useState<string>()
  const adapterRef = useRef<{ stop: () => void }>()

  useEffect(() => {
    const emitHandlers = {
      event: (e: RunEvent) => {
        setState((prev) => ({
          ...prev,
          events: [...prev.events, e].sort((a, b) => a.t - b.t),
        }))
      },
      log: (line: { t: number; text: string }) => {
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, line],
        }))
      },
      persona: (p: Partial<PersonaProgress> & { id: string }) => {
        setState((prev) => ({
          ...prev,
          personas: prev.personas.map((persona) => (persona.id === p.id ? { ...persona, ...p } : persona)),
        }))
      },
      status: (s: { status: RunStatus }) => {
        setState((prev) => ({
          ...prev,
          status: s.status,
        }))
      },
    }

    adapterRef.current = adapter.start(emitHandlers)

    return () => {
      adapterRef.current?.stop()
    }
  }, [adapter])

  const controls: LiveRunControls = {
    seek: (seconds: number) => {
      if (videoRef?.current) {
        videoRef.current.currentTime = seconds
      }
    },
    setRate: (rate: number) => {
      if (videoRef?.current) {
        videoRef.current.playbackRate = rate
      }
    },
    togglePlay: () => {
      if (videoRef?.current) {
        if (videoRef.current.paused) {
          videoRef.current.play()
        } else {
          videoRef.current.pause()
        }
      }
    },
    copyTimestamp: () => {
      if (videoRef?.current) {
        const time = Math.round(videoRef.current.currentTime)
        const url = `${window.location.pathname}?t=${time}`
        navigator.clipboard.writeText(window.location.origin + url)
      }
    },
    highlightEvent: (eventId: string) => {
      setHighlightedEventId(eventId)
      setTimeout(() => setHighlightedEventId(undefined), 2000)
    },
  }

  return <LiveRunContext.Provider value={{ state, controls }}>{children}</LiveRunContext.Provider>
}
