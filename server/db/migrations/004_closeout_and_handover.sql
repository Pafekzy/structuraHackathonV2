-- Migration 004: Closeout, Punch Items, Handover

CREATE TABLE IF NOT EXISTS closeouts (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(64) NOT NULL DEFAULT 'IN_PROGRESS',
    initiated_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    checklist JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_closeout_proj UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS punch_items (
    id VARCHAR(128) PRIMARY KEY,
    item_number VARCHAR(64) NOT NULL,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) REFERENCES milestones(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    zone VARCHAR(128),
    status VARCHAR(64) NOT NULL DEFAULT 'OPEN',
    created_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    assigned_to_user_id VARCHAR(128) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_punch_item_proj UNIQUE (project_id, item_number)
);

CREATE TABLE IF NOT EXISTS handovers (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
    prepared_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_by_user_id VARCHAR(128) REFERENCES users(id),
    accepted_at TIMESTAMPTZ,
    dossier JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_handover_proj UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_punch_proj ON punch_items(project_id);
CREATE INDEX IF NOT EXISTS idx_closeout_proj ON closeouts(project_id);
CREATE INDEX IF NOT EXISTS idx_handover_proj ON handovers(project_id);
