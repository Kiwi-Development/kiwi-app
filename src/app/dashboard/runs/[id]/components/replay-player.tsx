"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "../../../../../components/ui/button";
import { Slider } from "../../../../../components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  LinkIcon,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import type { RunEvent } from "../model";
import { useToast } from "../../../../../hooks/use-toast";
import { MarkerBar } from "./marker-bar";

interface ReplayPlayerProps {
  videoUrl?: string;
  events: RunEvent[];
  onSeek?: (time: number) => void;
  initialTime?: number;
}

export const ReplayPlayer = forwardRef<HTMLVideoElement, ReplayPlayerProps>(
  ({ videoUrl, events, onSeek, initialTime = 0 }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { toast } = useToast();

    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleCanPlay = () => {
        setIsLoading(false);
        // Autoplay when video is ready
        video
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            // Autoplay might be blocked by browser, that's okay
            console.log("[v0] Autoplay blocked:", error);
          });
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleTimeUpdate = () => setCurrentTime(video.currentTime);
      const handleDurationChange = () => setDuration(video.duration);
      const handleWaiting = () => setIsLoading(true);
      const handleError = () => {
        toast({
          title: "Video error",
          description: "Failed to load video. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
      };

      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("durationchange", handleDurationChange);
      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("durationchange", handleDurationChange);
        video.removeEventListener("waiting", handleWaiting);
        video.removeEventListener("error", handleError);
      };
    }, [toast]);

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
      if (videoRef.current && initialTime > 0) {
        videoRef.current.currentTime = initialTime;
      }
    }, [initialTime]);

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;

      if (isPlaying) {
        video.pause();
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    };

    const skipTime = (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;

      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      video.currentTime = newTime;
      onSeek?.(newTime);
    };

    const handleSeek = (value: number[]) => {
      const video = videoRef.current;
      if (!video) return;

      video.currentTime = value[0];
      onSeek?.(value[0]);
    };

    const changePlaybackRate = (rate: number) => {
      const video = videoRef.current;
      if (!video) return;

      video.playbackRate = rate;
      setPlaybackRate(rate);
    };

    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;

      video.muted = !video.muted;
      setIsMuted(!video.muted);
    };

    const toggleFullscreen = async () => {
      const container = containerRef.current;
      if (!container) return;

      try {
        if (!document.fullscreenElement) {
          await container.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        toast({
          title: "Fullscreen error",
          description: "Unable to toggle fullscreen mode",
          variant: "destructive",
        });
      }
    };

    const copyTimestamp = () => {
      const time = Math.round(currentTime);
      const url = `${window.location.pathname}?t=${time}`;
      navigator.clipboard.writeText(window.location.origin + url);
      toast({
        title: "Link copied",
        description: `Timestamp link for ${formatTime(time)} copied to clipboard`,
      });
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const seekToEvent = (eventTime: number) => {
      const video = videoRef.current;
      if (!video) return;

      video.currentTime = eventTime;
      onSeek?.(eventTime);

      // Scroll video into view
      video.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    return (
      <div className="space-y-4" data-testid="replay-player" ref={containerRef}>
        {/* Video Container */}
        <div className="relative aspect-video rounded-lg bg-muted overflow-hidden">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full"
              data-testid="replay-video"
              aria-label="Usability test replay video"
            >
              <track kind="captions" label="Captions not available" />
            </video>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2 p-6">
                <p className="text-sm font-medium text-muted-foreground">No video configured</p>
                <p className="text-xs text-muted-foreground">
                  Upload or set demo video in Settings → Integrations
                </p>
              </div>
            </div>
          )}

          {isLoading && videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Progress Bar with Markers */}
          <div className="space-y-2">
            <MarkerBar
              events={events}
              duration={duration}
              currentTime={currentTime}
              onSeek={seekToEvent}
            />
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              disabled={!videoUrl}
              className="w-full"
              aria-label="Video progress"
            />
          </div>

          {/* Time Display */}
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="space-y-3">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => skipTime(-10)}
                disabled={!videoUrl}
                aria-label="Skip back 10 seconds"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={togglePlay}
                disabled={!videoUrl}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => skipTime(10)}
                disabled={!videoUrl}
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMute}
                disabled={!videoUrl}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleFullscreen}
                disabled={!videoUrl}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>

            {/* Playback Rate & Timestamp */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {[0.5, 1, 1.5, 2].map((rate) => (
                  <Button
                    key={rate}
                    size="sm"
                    variant={playbackRate === rate ? "secondary" : "ghost"}
                    onClick={() => changePlaybackRate(rate)}
                    disabled={!videoUrl}
                    className="text-xs px-2 h-8"
                    aria-label={`Playback speed ${rate}x`}
                  >
                    {rate}x
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={copyTimestamp}
                disabled={!videoUrl}
                data-testid="copy-timestamp"
                aria-label="Copy link to timestamp"
                className="h-8"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                Copy link
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ReplayPlayer.displayName = "ReplayPlayer";
