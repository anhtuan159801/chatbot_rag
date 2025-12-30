# Migrations Changelog

This file tracks all database migrations, data fixes, and maintenance operations.

## Schema Migrations

### 2025-01-02

#### 20250102_0900_create_complete_schema.sql

- **Author**: System
- **Description**: Initial complete database schema creation
- **Tables**: knowledge_base, knowledge_chunks, ai_models, ai_role_assignments, system_configs
- **Rollback**: Drop all created tables

#### 20250102_1200_add_fulltext_search_index.sql

- **Author**: System
- **Description**: Add full-text search support for hybrid RAG
- **Changes**:
  - Added `content_vector` column (tsvector) to `knowledge_chunks`
  - Created trigger for auto-updating tsvector
  - Created GIN index for fast text search
- **Rollback**: Drop column and trigger

## Data Fixes

### 2025-01-03

#### 20250103_1000_fix_embedding_dimensions.sql

- **Author**: System
- **Description**: Fix embedding dimension inconsistencies
- **Changes**: Updated all embeddings to use 384 dimensions (BGE-small)
- **Verification**: `SELECT COUNT(*) FROM knowledge_chunks WHERE array_length(embedding, 1) != 384;`

#### 20250103_1100_fix_facebook_config.sql

- **Author**: System
- **Description**: Fix Facebook configuration structure
- **Changes**: Updated config format in system_configs table
- **Verification**: `SELECT * FROM system_configs WHERE key = 'facebook_config';`

## Embedding Operations

### 2025-01-03

#### 20250103_1200_embedding_update_qwen3_v3.sql

- **Author**: System
- **Description**: Update embedding model to Qwen3 v3
- **Changes**: Changed model_string for embedding role
- **Verification**: Check embedding generation with new model

#### 20250103_1300_embedding_fix_dimensions.sql

- **Author**: System
- **Description**: Fix incorrect embedding dimensions in knowledge_chunks
- **Changes**: Recalculated all embeddings with correct dimensions
- **Verification**: Validate all embeddings match expected dimension count

## Maintenance

### 2025-01-04

#### 20250104_1000_maintenance_rebuild_indexes.sql

- **Author**: System
- **Description**: Rebuild all database indexes for performance
- **Changes**: REINDEX on all indexes
- **Impact**: Improved query performance

---

## Execution Log

| Date       | Migration                                   | Status | Executed By | Notes              |
| ---------- | ------------------------------------------- | ------ | ----------- | ------------------ |
| 2025-01-02 | 20250102_0900_create_complete_schema.sql    | ✅     | System      | Initial setup      |
| 2025-01-02 | 20250102_1200_add_fulltext_search_index.sql | ✅     | System      | Hybrid RAG support |
