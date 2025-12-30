# Migration Template - Data Fixes
# ============================================================================
# Author: YOUR_NAME
# Date: YYYY-MM-DD
# Description: Brief description of what this fix does
# ============================================================================

-- Check current state
-- SELECT * FROM table_name WHERE condition;

-- Apply fix
-- UPDATE table_name SET column = value WHERE condition;

-- ============================================================================
-- Verification
# ============================================================================
-- Run verification query to check the fix was applied
-- SELECT * FROM table_name WHERE column = value;

-- ============================================================================
-- Rollback
-- ============================================================================
-- UPDATE table_name SET column = old_value WHERE condition;
