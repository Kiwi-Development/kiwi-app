#!/bin/bash
# Script to run Supabase database migrations
# Usage: ./scripts/migrate-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/add_browserbase_session_id.sql"

echo "🗄️  Running Supabase database migration..."
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Using manual SQL method instead."
    echo ""
    echo "📋 Option 1: Using Supabase Dashboard (Recommended)"
    echo "   1. Go to your Supabase project → SQL Editor"
    echo "   2. Copy and paste the SQL from: $MIGRATION_FILE"
    echo "   3. Click 'Run' to execute"
    echo ""
    echo "📋 Option 2: Install Supabase CLI and run:"
    echo "   npm install -g supabase"
    echo "   supabase migration up"
    echo ""
    exit 0
fi

# Try to use Supabase CLI
echo "✅ Supabase CLI found. Attempting to run migration..."
echo ""

cd "$PROJECT_ROOT"

# Check if project is linked
if [ -f "supabase/.temp/project-ref" ]; then
    echo "Running migration with Supabase CLI..."
    supabase migration up
else
    echo "⚠️  Supabase project not linked locally."
    echo ""
    echo "📋 Option 1: Link your project first:"
    echo "   supabase link --project-ref <your-project-ref>"
    echo "   supabase migration up"
    echo ""
    echo "📋 Option 2: Use Supabase Dashboard (Recommended for one-off migrations)"
    echo "   1. Go to your Supabase project → SQL Editor"
    echo "   2. Copy and paste the SQL from: $MIGRATION_FILE"
    echo "   3. Click 'Run' to execute"
    echo ""
    echo "SQL to run:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$MIGRATION_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi


