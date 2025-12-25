# 🥝 Scripts

This folder contains helper scripts for Kiwi development and deployment.

## Available Scripts

### Development Scripts

#### Start Frontend (Mac/Linux)

```bash
./scripts/start-frontend.sh
# or
npm run dev
```

#### Start Backend (Mac/Linux)

```bash
./scripts/start-backend.sh
```

#### Start Both (Mac/Linux)

```bash
./scripts/start-all.sh
# or
npm run dev:all
```

### Windows Scripts

For Windows users, use the `.bat` files:

```cmd
scripts\start-frontend.bat
scripts\start-backend.bat
scripts\start-all.bat
```

## What Each Script Does

### `start-backend.sh`

- Activates Python virtual environment
- Checks for dependencies
- Installs dependencies if missing
- Starts Flask server on port 5001

### `start-frontend.sh`

- Checks for node_modules
- Installs dependencies if missing
- Starts Next.js dev server on port 3000

### `start-all.sh`

- Starts both frontend and backend
- Runs them in background processes
- Shows URLs for both servers
- Handles cleanup on Ctrl+C

## NPM Scripts

The following npm scripts are available:

- `npm run dev` - Start frontend only
- `npm run dev:all` - Start both servers (Mac/Linux)
- `npm run setup` - Full setup (installs all dependencies)
- `npm run check` - Run all code quality checks (TypeScript, ESLint, Prettier)
- `npm run fix` - Auto-fix linting and formatting issues

## Notes

- On Windows, use the `.bat` files directly or run the Python/Node commands manually
- The scripts automatically check for dependencies and install them if missing
- Make sure you have `.env.local` configured before starting
