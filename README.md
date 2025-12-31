# 🥝 Kiwi - AI-Native Usability Testing

Kiwi is an AI-powered usability testing platform that automates user testing by simulating personas and analyzing UI/UX interactions. The platform uses AI agents to navigate prototypes, capture screenshots, and provide detailed usability feedback.

Built with Next.js, FastAPI, Playwright, and OpenAI.

## Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (3.8 or higher)
- **Supabase account** (for database and authentication)
- **OpenAI API key** (for AI-powered testing)

### Local Development Setup

#### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
cd ..
```

#### 2. Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI (for AI-powered testing)
OPENAI_API_KEY=your_openai_api_key

# Backend Server (for local development)
NEXT_PUBLIC_EC2_IP=localhost
NEXT_PUBLIC_BACKEND_PORT=5001
```

**Where to get these values:**

- **Supabase**: Go to your Supabase project → Settings → API
- **OpenAI**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)

#### 3. Run the Application

Start both frontend and backend:

```bash
npm run dev:all
```

Or start separately:

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend
source venv/bin/activate
python server.py
```

**Server URLs:**

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:5001](http://localhost:5001)

## Production Deployment

### Deploy Frontend to Vercel

1. **Push your code to GitHub**

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project" → Import your repository
   - Vercel will auto-detect Next.js settings

3. **Set Environment Variables in Vercel:**
   - Go to Settings → Environment Variables
   - Add these required variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     NEXT_PUBLIC_EC2_IP=your-backend-url.onrender.com (set after backend deployment)
     NEXT_PUBLIC_BACKEND_PORT=5001
     OPENAI_API_KEY=your_openai_api_key
     ```
   - Select **Production, Preview, and Development** for each
   - Click "Deploy"

### Deploy Backend to Render

1. **Go to [render.com](https://render.com)** and sign in with GitHub

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `kiwi-backend`
     - **Root Directory**: `backend`
     - **Environment**: Python 3
     - **Build Command**: `pip install -r requirements.txt && playwright install chromium`
     - **Note**: If you get "Executable doesn't exist" errors, the browsers may need to be installed. Try the build command again or check Render logs.
     - **Start Command**: `python server.py`
     - **Health Check Path**: `/health`

3. **Add Environment Variables:**
   - **PORT**: `5001`
   - **ALLOWED_ORIGINS**: `https://your-vercel-app.vercel.app` (your Vercel URL)

4. **Deploy and get your Render URL** (e.g., `kiwi-backend.onrender.com`)

5. **Update Vercel:**
   - Go back to Vercel → Settings → Environment Variables
   - Update `NEXT_PUBLIC_EC2_IP` with your Render URL (no `http://`)
   - Redeploy

## Project Structure

- `/src` - Next.js frontend application
- `/backend` - Python FastAPI server with Playwright browser automation
- `/public` - Static assets

## Available Scripts

- `npm run dev` - Start Next.js frontend only
- `npm run dev:all` - Start both frontend and backend servers
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript, ESLint, and Prettier checks
- `npm run fix` - Auto-fix linting and formatting issues

## Troubleshooting

### Backend Connection Issues

- Ensure the backend server is running on port 5001
- Check that `NEXT_PUBLIC_EC2_IP` and `NEXT_PUBLIC_BACKEND_PORT` are set correctly
- Verify `ALLOWED_ORIGINS` in Render includes your Vercel URL

### OpenAI API Issues

- Check your API key is set correctly
- Verify you have credits in your OpenAI account

### Supabase Authentication Issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Ensure Email authentication is enabled in Supabase dashboard
