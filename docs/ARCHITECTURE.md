# 🥝 Architecture Overview

## Current Simplified Architecture

```
┌─────────────────┐         HTTP/REST         ┌──────────────────┐
│   Next.js App   │ ────────────────────────> │  FastAPI Backend │
│   (Frontend)    │ <──────────────────────── │  (Playwright)    │
│   Port 3000     │         Screenshots       │   Port 5001      │
└─────────────────┘                           └──────────────────┘
        │                                              │
        │                                              │
        v                                              v
┌─────────────────┐                            ┌──────────────────┐
│   Supabase      │                            │   OpenAI API     │
│   (Auth)        │                            │   (AI Agent)     │
└─────────────────┘                            └──────────────────┘
```

## Components

### Frontend (Next.js)

- **Location**: `/src`
- **Port**: 3000 (dev), production on Vercel
- **Purpose**: UI, user authentication, test management
- **Storage**: localStorage (tests, personas, runs)
- **Auth**: Supabase

### Backend (FastAPI + Playwright)

- **Location**: `/backend`
- **Port**: 5001 (dev)
- **Purpose**: Browser automation, screenshot capture, click simulation
- **Tech**: FastAPI, Playwright (Chromium)

### External Services

- **Supabase**: User authentication
- **OpenAI**: AI agent for test execution
- **Google Sheets** (optional): Waitlist management

## Data Flow

1. User creates a test → stored in localStorage
2. User starts a test run → Frontend calls OpenAI API
3. OpenAI agent requests screenshots → Frontend calls FastAPI backend
4. FastAPI backend uses Playwright to:
   - Navigate to URL
   - Take screenshots
   - Simulate clicks
5. Screenshots sent back to OpenAI agent
6. Agent makes decisions and requests actions
7. Results stored in localStorage

## Deployment Options

### Option 1: Simple & Recommended (Current)

**Frontend**: Vercel (free tier)
**Backend**: Railway / Render / Fly.io

- ✅ Easiest setup
- ✅ No Docker needed (they handle it)
- ✅ Auto-deploy from Git
- ✅ Free tier available
- ✅ Built-in HTTPS

### Option 2: Single Server

**Both**: Single VPS (DigitalOcean, Linode, etc.)

- ✅ Full control
- ✅ Can run both on one server
- ⚠️ Need to manage server yourself
- ⚠️ Need to set up reverse proxy (nginx)

### Option 3: AWS (Overkill for now)

**Frontend**: Vercel or AWS Amplify
**Backend**: AWS ECS Fargate or EC2

- ✅ Scalable
- ❌ Complex setup
- ❌ More expensive
- ❌ Over-engineered for current needs

## Local Development

### Quick Start

```bash
# Terminal 1: Frontend
npm run dev
# Frontend runs on http://localhost:3000

# Terminal 2: Backend
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python server.py
# Backend runs on http://localhost:5001
```

### Environment Setup

Make sure you have a `.env.local` file with:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `OPENAI_API_KEY` (required)
- `NEXT_PUBLIC_EC2_IP=localhost` and `NEXT_PUBLIC_BACKEND_PORT=5001` (optional, defaults)
- `OPENAI_MODEL=gpt-4o` (optional, defaults to gpt-4o)

## Production Deployment (Recommended: Railway)

### Backend on Railway:

1. Connect GitHub repo
2. Set root directory to `/backend`
3. Railway auto-detects Python
4. Add environment variables
5. Deploy!

### Frontend on Vercel:

1. Connect GitHub repo
2. Set root directory to `/`
3. Add environment variables
4. Deploy!

## What We Removed

- ❌ AWS ECS/EC2 SDK code (unused, removed from `src/app/actions.ts`)
- ❌ Docker complexity (not needed for Railway/Render, removed `backend/dockerfile`)
- ❌ boto3 dependency (removed from `backend/requirements.txt`)
- ❌ AWS SDK packages (removed `@aws-sdk/client-ec2` and `@aws-sdk/client-ecs` from `package.json`)

## Future Considerations

If you need to scale:

- Add Redis for session management
- Move localStorage data to Supabase database
- Add queue system (BullMQ) for test execution
- Consider serverless functions for AI agent
