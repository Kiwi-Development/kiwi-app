# Live Replay View

This directory contains the V1 implementation of Kiwi's Live Replay view for usability test runs.

## Features

- **HTML5 Video Playback**: Full video controls with play/pause, seeking, playback rate adjustment
- **Timestamp Markers**: Visual markers on the timeline that sync with events
- **Live Persona Progress**: Real-time progress bars for each persona variant
- **Live Log Feed**: Scrolling log with auto-scroll and "Jump to Live" functionality
- **Event Timeline**: Clickable event chips that seek to timestamps
- **Deep Linking**: Support for `?t=seconds` URL parameter
- **Mock Adapter**: Replaceable adapter pattern for easy backend integration

## Configuration

### Changing the Demo Video

The video source can be configured via environment variable:

\`\`\`bash
NEXT_PUBLIC_DEMO_VIDEO_URL=https://example.com/demo.mp4
\`\`\`

Or place a video file at `public/demo.mp4`.

### Adjusting Seeded Event Times

Edit the `eventTimeline` array in `app/runs/[id]/adapter.ts`:

\`\`\`typescript
const eventTimeline = [
  { t: 12, event: { ... } },  // Event at 12 seconds
  { t: 23, event: { ... } },  // Event at 23 seconds
  // Add more events here
];
\`\`\`

### Plugging in a Real Adapter

The `LiveRunAdapter` interface is designed to be swappable:

1. Create a new adapter class implementing `LiveRunAdapter`
2. Replace `MockLiveRunAdapter` with your implementation in `page.tsx`
3. Your adapter should handle SSE/WebSocket connections and emit events via the provided callbacks

Example:

\`\`\`typescript
export class SSELiveRunAdapter implements LiveRunAdapter {
  start(emit: { ... }) {
    const eventSource = new EventSource('/api/runs/stream');
    
    eventSource.addEventListener('event', (e) => {
      emit.event(JSON.parse(e.data));
    });
    
    // ... handle other event types
    
    return {
      stop: () => eventSource.close()
    };
  }
}
\`\`\`

## Testing

All interactive elements have `data-testid` attributes for easy E2E testing:

- `run-status-chip`
- `persona-row-{id}`
- `replay-video`
- `marker-{eventId}`
- `log-line-{index}`
- `timeline-event-{eventId}`
- `copy-timestamp`

## Accessibility

- Full keyboard navigation support
- ARIA labels on all interactive elements
- Visible focus rings
- Screen reader announcements for state changes
- Captions support (track element included)
