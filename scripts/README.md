# Scripts

Utility scripts for development and database management.

## Available Scripts

### Database Migration

```bash
npm run migrate-db
# or
./scripts/migrate-db.sh
```

Runs Supabase database migrations. This script applies all pending migrations from the `supabase/migrations/` directory.

**Requirements:**

- Supabase CLI installed (`npm install -g supabase`)
- Supabase project linked (`supabase link --project-ref your-project-ref`)
- Or manually run SQL from `supabase/migrations/add_browserbase_session_id.sql` in Supabase dashboard

## Running Services

### Frontend (Next.js)

```bash
npm run dev
```

Starts the Next.js development server on `http://localhost:3000`.

### Test Runner Service

```bash
cd services/test-runner
npm run dev
```

Starts the test runner service on `http://localhost:3001`.

See `services/test-runner/README.md` for more information about the test runner service.

## Deprecated Scripts

The following scripts have been removed as part of the migration to a services architecture:

- `start-backend.sh` / `start-backend.bat` - Backend service moved to `services/test-runner/`
- `start-frontend.sh` / `start-frontend.bat` - Use `npm run dev` instead
- `start-all.sh` / `start-all.bat` - Services run independently now
- `ingest-knowledge.ts` - Knowledge ingestion moved to `services/test-runner/`

## Development Workflow

1. **Start the test runner service** (Terminal 1):

   ```bash
   cd services/test-runner
   npm run dev
   ```

2. **Start the frontend** (Terminal 2):

   ```bash
   npm run dev
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Test Runner API: http://localhost:3001
