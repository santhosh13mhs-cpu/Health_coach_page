#!/bin/bash
# Bash script to automatically set up DATABASE_URL from RENDER_DATABASE_URL.txt
# This script reads the connection string and adds it to backend/.env

echo "🔧 Setting up DATABASE_URL automatically..."

# Read the connection string from RENDER_DATABASE_URL.txt
CONNECTION_STRING_FILE="RENDER_DATABASE_URL.txt"
BACKEND_ENV_FILE="backend/.env"

if [ ! -f "$CONNECTION_STRING_FILE" ]; then
    echo "❌ Error: $CONNECTION_STRING_FILE not found!"
    echo "   Please make sure RENDER_DATABASE_URL.txt exists in the project root."
    exit 1
fi

# Extract connection string from the file (look for postgresql:// line)
CONNECTION_STRING=$(grep -oP 'postgresql://[^\s]+' "$CONNECTION_STRING_FILE" | head -1)

if [ -z "$CONNECTION_STRING" ]; then
    echo "❌ Error: Could not find connection string in $CONNECTION_STRING_FILE"
    exit 1
fi

echo "✅ Found connection string"

# Ensure backend directory exists
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found!"
    exit 1
fi

# Read existing .env file if it exists, remove old DATABASE_URL line
if [ -f "$BACKEND_ENV_FILE" ]; then
    echo "📝 Reading existing $BACKEND_ENV_FILE..."
    grep -v '^DATABASE_URL=' "$BACKEND_ENV_FILE" > "${BACKEND_ENV_FILE}.tmp" 2>/dev/null || true
    mv "${BACKEND_ENV_FILE}.tmp" "$BACKEND_ENV_FILE" 2>/dev/null || touch "$BACKEND_ENV_FILE"
else
    touch "$BACKEND_ENV_FILE"
fi

# Add DATABASE_URL
echo "DATABASE_URL=$CONNECTION_STRING" >> "$BACKEND_ENV_FILE"

echo "✅ Successfully configured DATABASE_URL in $BACKEND_ENV_FILE"
echo ""
echo "📋 Next steps:"
echo "   1. Run: npm run migrate-to-supabase"
echo "   2. Or run: npm run verify-supabase"
echo ""
