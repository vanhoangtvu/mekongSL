-- ============================================================================
-- Migration: V006__create_ai_conversation.sql
-- Description: Create tables for AI Assistant conversation history and management
-- Author: AI Assistant Module
-- Date: 2026-01-25
-- ============================================================================

-- Create ai_conversation table to store chat messages between user and AI
CREATE TABLE IF NOT EXISTS ai_conversation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- User and session tracking
    user_id BIGINT NOT NULL,
    session_id VARCHAR(100) NOT NULL COMMENT 'UUID for conversation session',
    
    -- Message content
    role VARCHAR(20) NOT NULL COMMENT 'user or assistant',
    content TEXT NOT NULL COMMENT 'Message text content',
    
    -- Function calling details (for AI assistant messages)
    function_call JSON COMMENT 'Function call details if AI called a function',
    function_result JSON COMMENT 'Result from function execution',
    
    -- Metadata
    tokens_used INT DEFAULT 0 COMMENT 'Number of tokens consumed by this message',
    model VARCHAR(100) COMMENT 'AI model used (e.g., qwen/qwen-2.5-27b-instruct)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for fast retrieval
    INDEX idx_session (session_id, created_at),
    INDEX idx_user (user_id, created_at DESC),
    INDEX idx_user_session (user_id, session_id),
    
    -- Foreign key constraint
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI Assistant conversation history with function calling support';

-- Create ai_session table to track session metadata
CREATE TABLE IF NOT EXISTS ai_session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Session identification
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    
    -- Session metadata
    title VARCHAR(500) COMMENT 'Auto-generated or user-defined session title',
    message_count INT DEFAULT 0 COMMENT 'Total number of messages in session',
    total_tokens INT DEFAULT 0 COMMENT 'Total tokens consumed in this session',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP NULL COMMENT 'Timestamp of last message',
    
    -- Indexes
    INDEX idx_user_updated (user_id, updated_at DESC),
    INDEX idx_session_id (session_id),
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='AI Assistant session metadata and tracking';

-- Create ai_function_log table to track function executions
CREATE TABLE IF NOT EXISTS ai_function_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Reference to conversation
    conversation_id BIGINT,
    session_id VARCHAR(100) NOT NULL,
    user_id BIGINT NOT NULL,
    
    -- Function execution details
    function_name VARCHAR(200) NOT NULL,
    arguments JSON NOT NULL,
    result JSON,
    
    -- Execution metadata
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    execution_time_ms INT COMMENT 'Function execution duration in milliseconds',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_session (session_id, created_at),
    INDEX idx_function_name (function_name, created_at DESC),
    INDEX idx_user (user_id, created_at DESC),
    
    -- Foreign keys
    FOREIGN KEY (conversation_id) REFERENCES ai_conversation(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Log of AI function executions for debugging and analytics';

-- Create ai_token_usage table to track token consumption per user
CREATE TABLE IF NOT EXISTS ai_token_usage (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    user_id BIGINT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    
    -- Token tracking
    total_tokens INT DEFAULT 0,
    request_count INT DEFAULT 0,
    
    -- Quota management
    quota_limit INT DEFAULT 100000 COMMENT 'Monthly token quota (default 100K)',
    quota_exceeded BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Unique constraint: one record per user per month
    UNIQUE KEY uk_user_month (user_id, year, month),
    
    -- Indexes
    INDEX idx_user (user_id),
    INDEX idx_period (year, month),
    
    -- Foreign key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Monthly token usage tracking and quota management';

-- ============================================================================
-- Migration completed successfully
-- ============================================================================
