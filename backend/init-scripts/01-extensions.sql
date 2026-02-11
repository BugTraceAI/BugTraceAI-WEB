-- Install PostgreSQL extensions for BugTraceAI-WEB
-- This script runs automatically when the container is first created

-- Enable UUID generation (required for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for full-text search on chat messages
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable btree_gin for advanced indexing (useful for JSONB columns)
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin');
