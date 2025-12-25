# 🥝 Kiwi - AI-Native Usability Testing

Kiwi is an AI-powered usability testing platform that automates user testing by simulating personas and analyzing UI/UX interactions. The platform uses AI agents to navigate prototypes, capture screenshots, and provide detailed usability feedback.

Built with Next.js, FastAPI, Playwright, and OpenAI.

## Prerequisites

Before running this project locally, you'll need:

1. **Node.js** (v18 or higher recommended)
   - Check with: `node --version`
   - Download from: https://nodejs.org/

2. **Python** (3.8 or higher)
   - Check with: `python3 --version`
   - Download from: https://www.python.org/

3. **npm** (comes with Node.js)
   - Check with: `npm --version`

## Setup Instructions

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Install Backend Dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install  # Install Playwright browsers
cd ..
```

### 3. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

**Required:**

```bash
# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI (for AI-powered testing)
OPENAI_API_KEY=your_openai_api_key
```

**Optional (for full functionality):**

```bash
# Backend Server Configuration (defaults to localhost:5001 if not set)
# Set to localhost for local development, or remote URL for production
NEXT_PUBLIC_EC2_IP=localhost
NEXT_PUBLIC_BACKEND_PORT=5001

# OpenAI Model Selection (defaults to gpt-4o if not set)
# Options: gpt-4o, gpt-4o-mini, gpt-4-turbo
OPENAI_MODEL=gpt-4o

# Google Sheets (for waitlist feature)
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email
GOOGLE_SHEETS_PRIVATE_KEY=your_service_account_private_key
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
```

### 4. Running the Application

**Option 1: Use npm scripts (Recommended)**

Start both servers at once:

```bash
npm run dev:all
```

Or start frontend only:

```bash
npm run dev
```

**Option 2: Use scripts directly**

```bash
# Mac/Linux - Start both
./scripts/start-all.sh

# Mac/Linux - Start separately
./scripts/start-frontend.sh
./scripts/start-backend.sh

# Windows - Start both (opens separate windows)
scripts\start-all.bat

# Windows - Start separately
scripts\start-frontend.bat
scripts\start-backend.bat
```

**Option 3: Manual start**

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python server.py
```

**Server URLs:**

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:5001](http://localhost:5001)

**Important:** The backend server is required for the app to function. Make sure both the frontend and backend are running simultaneously. The frontend will connect to `localhost:5001` by default (or whatever you set in `NEXT_PUBLIC_EC2_IP` and `NEXT_PUBLIC_BACKEND_PORT`).

## Project Structure

- `/src` - Next.js frontend application
- `/backend` - Python FastAPI server with Playwright browser automation
- `/public` - Static assets
- `/docs` - Project documentation

## Documentation

See the [docs](./docs/) folder for detailed documentation:

- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture, deployment options, and data flow
- **[OpenAI Models](./docs/OPENAI_MODELS.md)** - Model selection, configuration, and testing guide
- **[Live Replay View](./docs/LIVE_REPLAY_VIEW.md)** - Feature documentation

## Available Scripts

### Development

- `npm run dev` - Start Next.js frontend only
- `npm run dev:all` - Start both frontend and backend servers
- `npm run setup` - Full setup (installs all dependencies)

### Production

- `npm run build` - Build for production
- `npm run start` - Start production server

### Code Quality

- `npm run check` - Run all checks (TypeScript, ESLint, Prettier)
- `npm run fix` - Auto-fix linting and formatting issues

See [scripts/README.md](./scripts/README.md) for more details on the helper scripts.

## Troubleshooting

### Backend Connection Issues

- Ensure the backend server is running on port 5001
- Check that `NEXT_PUBLIC_EC2_IP` and `NEXT_PUBLIC_BACKEND_PORT` are set correctly
- Verify CORS is enabled in the FastAPI backend

### OpenAI API Issues

- Check your API key is set in `.env.local`
- Verify you have credits in your OpenAI account
- See [OpenAI Models Guide](./docs/OPENAI_MODELS.md) for model configuration

### Supabase Authentication Issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Ensure Email authentication is enabled in Supabase dashboard
- Check Supabase dashboard → Authentication → Users for created accounts

## Learn More

- [Architecture Documentation](./docs/ARCHITECTURE.md) - System design and deployment
- [OpenAI Models Guide](./docs/OPENAI_MODELS.md) - Model selection and configuration
- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
