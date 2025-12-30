-- ============================================================================
-- Embedding Operation: Update Qwen3 Embedding Model
-- ============================================================================
-- Author: System
-- Date: 2025-01-03
-- Description: Update embedding model configuration to Qwen3 v3
-- ============================================================================

-- Check current embedding model configuration
SELECT ar.role_key, am.id, am.name, am.model_string
FROM ai_role_assignments ar
JOIN ai_models am ON ar.model_id = am.id
WHERE ar.role_key = 'rag';

-- Update model_string for Qwen3 embedding
UPDATE ai_models
SET model_string = 'Qwen/Qwen2.5-1.5B-Instruct',
    updated_at = NOW()
WHERE id IN (
    SELECT model_id FROM ai_role_assignments WHERE role_key = 'rag'
);

-- Verify update
SELECT
    'Embedding model updated successfully' as status,
    m.id,
    m.model_string
FROM ai_models m
JOIN ai_role_assignments r ON m.id = r.model_id
WHERE r.role_key = 'rag';

-- ============================================================================
-- Rollback
-- ============================================================================
-- UPDATE ai_models
-- SET model_string = 'BAAI/bge-small-en-v1.5',
--     updated_at = NOW()
-- WHERE id IN (SELECT model_id FROM ai_role_assignments WHERE role_key = 'rag');
