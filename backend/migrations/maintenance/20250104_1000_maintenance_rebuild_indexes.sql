-- ============================================================================
-- Maintenance: Rebuild Database Indexes
-- ============================================================================
-- Author: System
-- Date: 2025-01-04
-- Description: Rebuild all indexes for performance optimization
-- ============================================================================

-- Rebuild vector index
REINDEX INDEX idx_knowledge_chunks_embedding;

-- Rebuild full-text search index
REINDEX INDEX knowledge_chunks_content_vector_idx;

-- Rebuild all other indexes
REINDEX INDEX idx_system_configs_updated_at;
REINDEX INDEX idx_ai_models_is_active;
REINDEX INDEX idx_ai_models_provider;
REINDEX INDEX idx_ai_models_updated_at;
REINDEX INDEX idx_knowledge_base_status;
REINDEX INDEX idx_knowledge_base_type;
REINDEX INDEX idx_knowledge_base_upload_date;
REINDEX INDEX idx_knowledge_base_vector_count;
REINDEX INDEX idx_knowledge_chunks_knowledge_base_id;
REINDEX INDEX idx_knowledge_chunks_chunk_index;
REINDEX INDEX idx_knowledge_chunks_created_at;
REINDEX INDEX idx_ai_role_assignments_model_id;
REINDEX INDEX idx_ai_role_assignments_updated_at;

-- Analyze tables for query optimization
ANALYZE system_configs;
ANALYZE ai_models;
ANALYZE knowledge_base;
ANALYZE knowledge_chunks;
ANALYZE ai_role_assignments;

-- ============================================================================
-- Verification
-- ============================================================================
-- Check index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- Rollback
-- ============================================================================
-- No rollback needed - this is a maintenance operation
