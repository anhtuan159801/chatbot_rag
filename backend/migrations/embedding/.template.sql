# Migration Template - Embedding Operations
# ============================================================================
# Author: YOUR_NAME
# Date: YYYY-MM-DD
# Description: Brief description of embedding operation
# ============================================================================

-- Check current embedding model configuration
-- SELECT ar.role_key, am.id, am.name, am.model_string
-- FROM ai_role_assignments ar
-- JOIN ai_models am ON ar.model_id = am.id
-- WHERE ar.role_key = 'rag';

-- Apply embedding changes
-- UPDATE ai_models SET model_string = 'new-model-string' WHERE id = 'model-id';

-- ============================================================================
-- Verification
# ============================================================================
-- SELECT * FROM ai_models WHERE id = 'model-id';

-- ============================================================================
# Rollback
-- ============================================================================
-- UPDATE ai_models SET model_string = 'old-model-string' WHERE id = 'model-id';
