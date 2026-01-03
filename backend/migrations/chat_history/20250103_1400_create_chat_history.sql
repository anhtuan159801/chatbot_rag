-- ============================================================================
-- Schema Migration: Create Chat History Table
-- ============================================================================
-- Author: System
-- Date: 2025-01-03
-- Description: Create chat_history table for storing conversation history
-- ============================================================================

-- Create Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    message_order INTEGER NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0),
    metadata JSONB DEFAULT '{}',
    retrieved_chunks UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT valid_message CHECK (
        session_id IS NOT NULL AND
        message_order IS NOT NULL AND
        sender IS NOT NULL AND
        content IS NOT NULL
    ),
    CONSTRAINT unique_message_order UNIQUE (session_id, message_order)
);

-- Create Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'web', 'api')),
    platform_user_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'archived')) DEFAULT 'active',
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    CONSTRAINT valid_session CHECK (
        platform IS NOT NULL
    )
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_history_sender ON chat_history(sender);
CREATE INDEX IF NOT EXISTS idx_chat_history_is_deleted ON chat_history(is_deleted);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_platform ON chat_sessions(platform);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_platform_user_id ON chat_sessions(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON chat_sessions(last_activity DESC);

-- Create Function to Update Session Activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET 
        last_activity = NOW(),
        message_count = message_count + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
    AFTER INSERT ON chat_history
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- ============================================================================
-- Rollback
-- ============================================================================
-- DROP TRIGGER IF EXISTS trigger_update_session_activity ON chat_history;
-- DROP FUNCTION IF EXISTS update_session_activity CASCADE;
-- DROP INDEX IF EXISTS idx_chat_sessions_last_activity;
-- DROP INDEX IF EXISTS idx_chat_sessions_status;
-- DROP INDEX IF EXISTS idx_chat_sessions_platform_user_id;
-- DROP INDEX IF EXISTS idx_chat_sessions_platform;
-- DROP INDEX IF EXISTS idx_chat_sessions_user_id;
-- DROP INDEX IF EXISTS idx_chat_history_is_deleted;
-- DROP INDEX IF EXISTS idx_chat_history_sender;
-- DROP INDEX IF EXISTS idx_chat_history_created_at;
-- DROP INDEX IF EXISTS idx_chat_history_session_id;
-- DROP TABLE IF EXISTS chat_history CASCADE;
-- DROP TABLE IF EXISTS chat_sessions CASCADE;
