-- Migration 003: Construction Lifecycle (Milestones, Evidence, Submissions, Technical Reviews, QA/QC, NCRs, Owner Decisions, AI Inspections)

CREATE TABLE IF NOT EXISTS milestones (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phase_order INT NOT NULL DEFAULT 1,
    planned_start_date VARCHAR(64),
    planned_end_date VARCHAR(64),
    actual_end_date VARCHAR(64),
    status VARCHAR(64) NOT NULL DEFAULT 'Upcoming',
    progress_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    cost_allocation_usd NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    financial_status VARCHAR(64),
    qa_qc_status VARCHAR(64),
    owner_decision_status VARCHAR(64),
    payout_approved BOOLEAN NOT NULL DEFAULT FALSE,
    escrow_status VARCHAR(64) DEFAULT 'Not Reached',
    active_inspection_id VARCHAR(128),
    active_ncr_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS evidence (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) REFERENCES milestones(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(64) NOT NULL,
    file_url VARCHAR(1024),
    uploaded_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS contractor_submissions (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    submission_number VARCHAR(64) NOT NULL,
    revision INT NOT NULL DEFAULT 1,
    status VARCHAR(64) NOT NULL DEFAULT 'SUBMITTED',
    submitted_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_proj_sub_number_rev UNIQUE (project_id, submission_number, revision)
);

CREATE TABLE IF NOT EXISTS technical_reviews (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    submission_id VARCHAR(128) NOT NULL REFERENCES contractor_submissions(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    reviewer_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    decision VARCHAR(64) NOT NULL,
    comments TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS qaqc_inspections (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    inspector_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    status VARCHAR(64) NOT NULL DEFAULT 'IN_PROGRESS',
    findings TEXT,
    compliance_score NUMERIC(5, 2),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ncrs (
    id VARCHAR(128) PRIMARY KEY,
    ncr_number VARCHAR(64) NOT NULL,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    inspection_id VARCHAR(128) REFERENCES qaqc_inspections(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'MAJOR',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    raised_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    assigned_to_user_id VARCHAR(128) REFERENCES users(id),
    corrective_action_response TEXT,
    raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_proj_ncr_number UNIQUE (project_id, ncr_number)
);

CREATE TABLE IF NOT EXISTS owner_decisions (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    owner_user_id VARCHAR(128) NOT NULL REFERENCES users(id),
    decision VARCHAR(64) NOT NULL,
    comments TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    financial_authorized BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ai_inspections (
    id VARCHAR(128) PRIMARY KEY,
    project_id VARCHAR(128) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id VARCHAR(128) REFERENCES milestones(id) ON DELETE SET NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'COMPLETED',
    analysis_result JSONB,
    human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
    model VARCHAR(64) NOT NULL DEFAULT 'gemini-3.7-flash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_milestones_proj ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_proj ON contractor_submissions(project_id, milestone_id);
CREATE INDEX IF NOT EXISTS idx_reviews_submission ON technical_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_qaqc_milestone ON qaqc_inspections(milestone_id);
CREATE INDEX IF NOT EXISTS idx_ncrs_milestone ON ncrs(milestone_id);
CREATE INDEX IF NOT EXISTS idx_owner_decisions_milestone ON owner_decisions(milestone_id);
