# 🥝 Kiwi - AI-Native Usability Testing

Kiwi is an AI-powered usability testing platform that automates user testing by simulating personas and analyzing UI/UX interactions. The platform uses AI agents to navigate prototypes, capture screenshots, and provide detailed usability feedback.

Built with **Next.js**, **Stagehand v3** (Browserbase), **Supabase**, and **OpenAI**.

## Features

- 🤖 **AI-Powered Persona Simulation**: Create personas with AI assistance and simulate real user behavior
- 🎯 **Automated Testing**: Navigate websites and Figma prototypes using Stagehand v3
- 📊 **Comprehensive Reports**: Get detailed UI findings, accessibility insights, and conversion recommendations
- 📹 **Session Replay**: Watch full session replays using rrweb
- 🔄 **Real-time Updates**: Live browser view and real-time progress tracking
- 🎨 **Modern UI**: Beautiful, responsive interface built with Next.js and Tailwind CSS

## Architecture

- **Frontend**: Next.js 16 with TypeScript, React 19, and Tailwind CSS
- **Test Runner Service**: Node.js/Express service using Stagehand v3 for browser automation
- **Database**: Supabase (PostgreSQL) for data storage
- **Storage**: Supabase Storage for screenshots and evidence
- **Queue**: BullMQ with Redis for job processing
- **Browser Automation**: Stagehand v3 with Browserbase cloud browsers

## Prerequisites

- **Node.js** (v20 or higher)
- **Supabase account** (for database and authentication)
- **OpenAI API key** (for AI-powered persona generation and task rephrasing)
- **Browserbase account** (for cloud browser sessions)
- **Google Gemini API key** (for Stagehand agent - can use `GOOGLE_GENERATIVE_AI_API_KEY` or `MODEL_API_KEY`)
- **Redis** (optional, for production job queue - in-memory queue used in development)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/kiwi.git
cd kiwi
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install test-runner service dependencies
cd services/test-runner
npm install
cd ../..
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase (Database & Auth)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI (for AI-powered persona generation)
OPENAI_API_KEY=your_openai_api_key

# Browserbase (for browser automation)
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id

# Test Runner Service URL (for local development)
TEST_RUNNER_SERVICE_URL=http://localhost:3001
```

Create a `.env` file in `services/test-runner/`:

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
# Or use GOOGLE_GENERATIVE_AI_API_KEY (Stagehand's preferred env var)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_gemini_api_key

# OpenAI (for task rephrasing and persona generation)
OPENAI_API_KEY=your_openai_api_key

# Redis (optional - for production job queue)
REDIS_URL=redis://localhost:6379

# Service Configuration
PORT=3001
NODE_ENV=development
MAX_CONCURRENT_RUNS=5
```

### 4. Set Up Database

Run the migration to add the `browserbase_session_id` column to the `test_runs` table:

**Option 1: Using the migration script**

```bash
npm run migrate-db
```

**Option 2: Using Supabase Dashboard**

1. Go to your Supabase project → SQL Editor
2. Run the SQL from `supabase/migrations/add_browserbase_session_id.sql`

### 5. Set Up Supabase Storage

Create a storage bucket named `test-evidence` in your Supabase project:

1. Go to Storage in your Supabase dashboard
2. Click "New bucket"
3. Name it `test-evidence`
4. Make it public or configure appropriate policies

### 6. Run the Application

**Terminal 1: Start the test-runner service**

```bash
cd services/test-runner
npm run dev
```

**Terminal 2: Start the frontend**

```bash
npm run dev
```

**Server URLs:**
- Frontend: [http://localhost:3000](http://localhost:3000)
- Test Runner Service: [http://localhost:3001](http://localhost:3001)

## Project Structure

```
kiwi/
├── src/                    # Next.js frontend application
│   ├── app/               # Next.js app router pages and API routes
│   ├── components/        # React components
│   ├── lib/               # Utilities and stores
│   └── types/             # TypeScript type definitions
├── services/
│   └── test-runner/       # Node.js test runner service
│       ├── src/
│       │   ├── execution/ # Test execution logic
│       │   ├── reasoning/ # Multi-agent reasoning engine
│       │   ├── storage/    # Database operations
│       │   └── queue/     # Job queue management
│       └── package.json
├── supabase/
│   └── migrations/        # Database migrations
└── scripts/               # Utility scripts
```

## Available Scripts

### Root Directory

- `npm run dev` - Start Next.js frontend
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript, ESLint, and Prettier checks
- `npm run fix` - Auto-fix linting and formatting issues
- `npm run migrate-db` - Run database migrations

### Test Runner Service

- `npm run dev` - Start with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run type-check` - Type check without building
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## Development

### Creating a Test

1. Navigate to the Tests page
2. Click "New Test"
3. Fill in test details:
   - Title and goal
   - URL (website or Figma prototype)
   - Tasks to complete
   - Select a persona
4. Click "Run Simulation" to start the test

### Creating a Persona

1. Navigate to the Personas page
2. Click "New Persona"
3. Optionally use AI to generate persona details:
   - Click "Try AI"
   - Describe your persona in natural language
   - Click "Generate Persona"
   - Review and edit the generated details
4. Fill in persona details manually or use AI-generated content
5. Click "Create Persona"

### Viewing Results

- **Live Run Page**: Watch the simulation in real-time with live browser view, logs, and progress
- **Report Page**: View comprehensive findings, metrics, session replay, and action journey

## Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `TEST_RUNNER_SERVICE_URL` (your test-runner service URL)
4. Deploy

### Test Runner Service (Render/Railway)

1. Connect your GitHub repository
2. Set root directory to `services/test-runner`
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add all environment variables from `services/test-runner/.env`
6. Deploy

## Troubleshooting

### Test Runner Service Not Starting

- Check that all environment variables are set correctly
- Verify Supabase connection with service role key
- Ensure Browserbase API key and project ID are correct
- Check Redis connection if using production queue

### Browser Sessions Not Starting

- Verify Browserbase API key and project ID
- Check that `GOOGLE_GENERATIVE_AI_API_KEY` or `MODEL_API_KEY` is set
- Ensure the model name is correct (e.g., `google/gemini-3-pro-preview`)

### Frontend Connection Issues

- Verify `TEST_RUNNER_SERVICE_URL` is set correctly
- Check CORS settings if deploying to different domains
- Ensure the test-runner service is running and accessible

### Database Issues

- Run migrations: `npm run migrate-db`
- Verify Supabase connection strings
- Check that storage bucket `test-evidence` exists

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

See [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please open an issue on GitHub.
