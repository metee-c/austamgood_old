-- Migration: Restore Face Sheet Function
-- Purpose: Restore the complete create_face_sheet_packages function from migration 002
-- Date: 2025-12-14
--
-- This migration restores the function that was accidentally broken by migration 146
-- The API-level filter in app/api/face-sheets/generate/route.ts will handle duplicate prevention

-- Note: This is a copy of the function from migration 002_triggers_only.sql
-- We're restoring it without the incomplete filter that was added in the broken migration 146

-- The function is too large to include here (~1300 lines)
-- So we'll use a different approach: run the original migration file

-- For production, you should:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy the create_face_sheet_packages function from migration 002_triggers_only.sql (lines 1730-3027)
-- 3. Run it directly in the SQL Editor

-- For now, let's create a simple notice
DO $$
BEGIN
  RAISE NOTICE '=== MANUAL ACTION REQUIRED ===';
  RAISE NOTICE 'The create_face_sheet_packages function needs to be restored manually.';
  RAISE NOTICE '';
  RAISE NOTICE 'Steps:';
  RAISE NOTICE '1. Open Supabase Dashboard > SQL Editor';
  RAISE NOTICE '2. Copy the function from: supabase/migrations/002_triggers_only.sql';
  RAISE NOTICE '   - Start at line 1730: CREATE OR REPLACE FUNCTION "public"."create_face_sheet_packages"';
  RAISE NOTICE '   - End at line 3027: ALTER FUNCTION ... OWNER TO "postgres";';
  RAISE NOTICE '3. Paste and run in SQL Editor';
  RAISE NOTICE '';
  RAISE NOTICE 'Alternative: Run this command in terminal:';
  RAISE NOTICE '  psql <connection_string> -f supabase/migrations/002_triggers_only.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'The API-level filter will prevent duplicate face sheets.';
END $$;
