# Test Runner Service

Node.js/Express service for executing test runs using Stagehand v3 and Browserbase. This service handles browser automation, persona simulation, evidence capture, and report generation.

## Overview

The test runner service is responsible for:
- Managing Browserbase browser sessions
- Executing test tasks using Stagehand v3 agents
- Capturing screenshots and evidence
- Running multi-agent reasoning (UX, Accessibility, Conversion)
- Generating comprehensive test reports
- Managing job queues with BullMQ

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `services/test-runner/` directory:

```bash
# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=test-evidence

# Browserbase
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id

# AI Models
MODEL_NAME=google/gemini-3-pro-preview
MODEL_API_KEY=your_google_gemini_api_key

# OpenAI (for task rephrasing and persona generation)
OPENAI_API_KEY=your_openai_api_key

# Redis (optional - for production job queue)
# If not set, uses in-memory queue for development
REDIS_URL=redis://localhost:6379

# Service Configuration
PORT=3001
NODE_ENV=development
MAX_CONCURRENT_RUNS=5
```

### 3. Build

```bash
npm run build
```

### 4. Run

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
Returns health status and validates all connections (Supabase, Browserbase, Redis).

### Create Test Run
```
POST /api/test-runs
Body: {
  "testId": "test-uuid"
}
```
Creates a new test run and queues it for execution. Returns the test run ID.

### Get Test Run Status
```
GET /api/test-runs/:testRunId
```
Returns the current status, metrics, and progress of a test run.

### Get Test Runs by Test ID
```
GET /api/test-runs?testId=test-uuid&limit=10
```
Returns recent test runs for a specific test.

### Cancel Test Run
```
POST /api/test-runs/:testRunId/cancel
```
Cancels a running test run and cleans up the browser session.

### Get Test Run Stream (SSE)
```
GET /api/test-runs/:testRunId/stream
```
Server-Sent Events stream for real-time updates:
- `connected` - Connection established
- `session_ready` - Browser session initialized
- `progress` - Persona progress updates
- `log` - Persona messages and logs
- `event` - Timeline events (clicks, errors, etc.)
- `completed` - Test run completed
- `error` - Error occurred

### Get Session Recording
```
GET /api/sessions/:sessionId/recording
```
Retrieves rrweb recording events for a Browserbase session. Used for session replay.

### Get Reports
```
GET /api/reports/:testRunId
```
Returns findings and report data for a completed test run.

## Architecture

### Execution Flow

1. **Test Run Creation**: Test run is created and queued
2. **Session Initialization**: Browserbase session is created
3. **Task Execution**: Each task is executed using Stagehand agent:
   - Task is rephrased using OpenAI for better agent instructions
   - Agent navigates and interacts with the page
   - Screenshots and evidence are captured
   - Persona messages are streamed in real-time
4. **Evidence Collection**: All interactions, screenshots, and logs are stored
5. **Report Generation**: Multi-agent reasoning analyzes findings:
   - UX Auditor: UI/UX issues
   - Accessibility Specialist: Accessibility concerns
   - Conversion Expert: Conversion optimization opportunities
6. **Session Cleanup**: Browserbase session is closed

### Components

- **Session Manager** (`src/execution/session-manager.ts`): Manages Browserbase sessions and Stagehand initialization
- **Task Executor** (`src/execution/task-executor.ts`): Executes individual tasks using Stagehand agent
- **Test Run Orchestrator** (`src/execution/test-run-orchestrator.ts`): Orchestrates the full test run
- **Evidence Capture** (`src/execution/evidence-capture.ts`): Captures screenshots and interaction data
- **Reasoning Engine** (`src/reasoning/`): Multi-agent analysis system
- **Report Generator** (`src/execution/report-generator.ts`): Generates comprehensive reports
- **Job Queue** (`src/queue/job-queue.ts`): Manages test run jobs with BullMQ
- **Database** (`src/storage/database.ts`): Supabase database operations

## Connection Validation

All connections are validated at startup:
- Supabase database connection
- Supabase storage bucket access
- Browserbase API access
- Redis connection (if configured)
- Model API access

The service will fail fast if any required connection is invalid.

## Session Cleanup

Browserbase sessions are automatically cleaned up on:
- Normal completion
- Errors
- Timeouts
- Job cancellation
- Service shutdown

## Job Queue

The service uses BullMQ for job processing:
- **Development**: In-memory queue (no Redis required)
- **Production**: Redis-backed queue (requires `REDIS_URL`)

Jobs are processed with a configurable concurrency limit (`MAX_CONCURRENT_RUNS`, default: 5).

## Development

### Hot Reload

```bash
npm run dev
```

Uses `tsx watch` for automatic recompilation on file changes.

### Type Checking

```bash
npm run type-check
```

Runs TypeScript compiler without generating output files.

### Linting and Formatting

```bash
npm run lint
npm run format
```

## Deployment

### Docker

Build:
```bash
docker build -t test-runner .
```

Run:
```bash
docker run -p 3001:3001 --env-file .env test-runner
```

### Render/Railway

1. Set root directory to `services/test-runner`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Set all environment variables in the platform dashboard
5. Ensure Redis is configured for production (optional but recommended)

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (for admin operations) |
| `SUPABASE_STORAGE_BUCKET` | Yes | Storage bucket name for evidence (default: `test-evidence`) |
| `BROWSERBASE_API_KEY` | Yes | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | Yes | Browserbase project ID |
| `MODEL_NAME` | Yes | Model name for Stagehand (e.g., `google/gemini-3-pro-preview`) |
| `MODEL_API_KEY` | Yes | API key for the model (e.g., Google Gemini, OpenAI, etc.) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (for task rephrasing and persona generation) |
| `REDIS_URL` | No | Redis connection URL (for production job queue) |
| `PORT` | No | Server port (default: `3001`) |
| `NODE_ENV` | No | Environment (default: `development`) |
| `MAX_CONCURRENT_RUNS` | No | Max concurrent test runs (default: `5`) |

## Troubleshooting

### Service Won't Start

- Check all required environment variables are set
- Verify Supabase connection with service role key
- Ensure Browserbase credentials are correct
- Check Redis connection if using production queue

### Test Runs Failing

- Verify model API key is correct
- Check Browserbase session creation
- Review logs for specific error messages
- Ensure storage bucket exists and is accessible

### Connection Validation Failures

- Double-check all API keys and credentials
- Verify network connectivity
- Check Supabase project settings
- Ensure Browserbase project is active
