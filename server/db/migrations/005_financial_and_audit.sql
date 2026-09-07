-- Migration 005: Financial Instructions, Reconciliation Records, and Audit Events

CREATE TABLE IF NOT EXISTS financial_instructions (
    id VARCHAR(128) PRIMARY KEY,
    instruction_number VARCHAR(64) NOT NULL,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    submission_id VARCHAR(128) REFERENCES contractor_submissions(id) ON DELETE SET NULL,
    gross_amount_usd NUMERIC(15, 2) NOT NULL,
    retainage_withheld_usd NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_payable_usd NUMERIC(15, 2) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'AUTHORIZED_FOR_FINANCIAL_PROCESSING',
    provider_name VARCHAR(64) NOT NULL DEFAULT 'BMONI',
    provider_status VARCHAR(64),
    provider_transaction_id VARCHAR(128),
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_fin_idempotency UNIQUE (idempotency_key),
    CONSTRAINT uq_fin_proj_num UNIQUE (project_id, instruction_number)
);

CREATE TABLE IF NOT EXISTS reconciliation_records (
    id VARCHAR(128) PRIMARY KEY,
    instruction_id VARCHAR(128) NOT NULL REFERENCES financial_instructions(id) ON DELETE CASCADE,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'REQUIRED',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(128) PRIMARY KEY,
    actor_user_id VARCHAR(128) NOT NULL,
    organization_id VARCHAR(128),
    project_id VARCHAR(128),
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fin_proj ON financial_instructions(project_id);
CREATE INDEX IF NOT EXISTS idx_fin_milestone ON financial_instructions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_audit_proj ON audit_events(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);
