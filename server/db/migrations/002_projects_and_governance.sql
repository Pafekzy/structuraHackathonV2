-- Migration 002: Projects, Direct Line, RFIs, Decisions, and Notifications

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64),
    description TEXT,
    client_name VARCHAR(255),
    location VARCHAR(255),
    budget_usd NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS direct_line_threads (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_by VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS direct_line_messages (
    id VARCHAR(128) PRIMARY KEY,
    thread_id VARCHAR(128) NOT NULL REFERENCES direct_line_threads(id) ON DELETE CASCADE,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS rfis (
    id VARCHAR(128) PRIMARY KEY,
    rfi_number VARCHAR(64) NOT NULL,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'OPEN',
    raised_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    assigned_to_user_id VARCHAR(128) REFERENCES users(id),
    response TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_proj_rfi_number UNIQUE (project_id, rfi_number)
);

CREATE TABLE IF NOT EXISTS project_decisions (
    id VARCHAR(128) PRIMARY KEY,
    decision_number VARCHAR(64) NOT NULL,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'RECORDED',
    category VARCHAR(64),
    created_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_proj_decision_number UNIQUE (project_id, decision_number)
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id VARCHAR(128) REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_direct_line_proj ON direct_line_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_rfis_proj ON rfis(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_proj ON project_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
