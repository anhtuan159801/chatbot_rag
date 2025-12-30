-- ============================================================================
-- Data Fix: Update Facebook Configuration
-- ============================================================================
-- Author: System
-- Date: 2025-01-03
-- Description: Fix Facebook configuration structure in system_configs
-- ============================================================================

-- Check current config
SELECT key, value FROM system_configs WHERE key = 'facebook_config';

-- Update structure (API keys should come from environment variables)
UPDATE system_configs
SET value = jsonb_build_object(
    'pageId', COALESCE(value->>'pageId', ''),
    'accessToken', '', -- Will be loaded from env variable
    'pageName', COALESCE(value->>'pageName', '')
),
updated_at = NOW()
WHERE key = 'facebook_config';

-- ============================================================================
-- Verification
-- ============================================================================
SELECT key, value FROM system_configs WHERE key = 'facebook_config';

-- ============================================================================
-- Rollback
-- ============================================================================
-- UPDATE system_configs
-- SET value = '{"pageId":"","accessToken":"","pageName":""}'::jsonb
-- WHERE key = 'facebook_config';
