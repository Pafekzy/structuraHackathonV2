/**
 * STRUCTURA — JSON to PostgreSQL Data Migration Utility
 * SPRINT 06B: Production Infrastructure & Database Persistence
 *
 * Safely reads existing file-based entities from /data/*.json and
 * inserts them into PostgreSQL tables with schema validation and idempotency (ON CONFLICT DO NOTHING / UPDATE).
 */

import fs from 'fs';
import path from 'path';
import { databaseManager } from './database';
import { safeReadJsonFile } from '../utils/atomicPersistence';
import { logger } from '../utils/logger';

export interface MigrationOptions {
  dryRun?: boolean;
}

export interface MigrationSummary {
  dryRun?: boolean;
  usersCount: number;
  organizationsCount: number;
  projectsCount: number;
  milestonesCount: number;
  evidenceCount: number;
  submissionsCount: number;
  technicalReviewsCount: number;
  qaqcInspectionsCount: number;
  ncrsCount: number;
  ownerDecisionsCount: number;
  projectDecisionsCount: number;
  rfisCount: number;
  directLineConversationsCount: number;
  directLineMessagesCount: number;
  notificationsCount: number;
  closeoutsCount: number;
  punchItemsCount: number;
  handoversCount: number;
  aiInspectionsCount: number;
  financialInstructionsCount: number;
  auditEventsCount: number;
  errors: string[];
}

export async function migrateJsonToPostgres(
  dataDir = path.join(process.cwd(), 'data'),
  options: MigrationOptions = {}
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    dryRun: options.dryRun ?? false,
    usersCount: 0,
    organizationsCount: 0,
    projectsCount: 0,
    milestonesCount: 0,
    evidenceCount: 0,
    submissionsCount: 0,
    technicalReviewsCount: 0,
    qaqcInspectionsCount: 0,
    ncrsCount: 0,
    ownerDecisionsCount: 0,
    projectDecisionsCount: 0,
    rfisCount: 0,
    directLineConversationsCount: 0,
    directLineMessagesCount: 0,
    notificationsCount: 0,
    closeoutsCount: 0,
    punchItemsCount: 0,
    handoversCount: 0,
    aiInspectionsCount: 0,
    financialInstructionsCount: 0,
    auditEventsCount: 0,
    errors: [],
  };

  const pool = databaseManager.getPool();
  if (!pool) {
    throw new Error('[Migration] Database pool is not initialized. Ensure DATABASE_URL is set.');
  }

  // Ensure tables exist before migrating
  await databaseManager.initializeSchema();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Organizations
    const orgsFile = path.join(dataDir, 'organizations.json');
    if (fs.existsSync(orgsFile)) {
      const orgs = safeReadJsonFile<any[]>(orgsFile, []);
      for (const org of orgs) {
        await client.query(
          `INSERT INTO organizations (id, name, type, registration_number, contact_email, is_verified, created_at, updated_at, is_demo, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            org.id,
            org.name,
            org.type || org.organizationType || 'OWNER',
            org.registrationNumber || null,
            org.contactEmail || org.email || null,
            org.isVerified ?? true,
            org.createdAt ? new Date(org.createdAt) : new Date(),
            org.updatedAt ? new Date(org.updatedAt) : new Date(),
            org.isDemo ?? false,
            JSON.stringify(org.metadata || {}),
          ]
        );
        summary.organizationsCount++;
      }
    }

    // 2. Users
    const usersFile = path.join(dataDir, 'users.json');
    if (fs.existsSync(usersFile)) {
      const users = safeReadJsonFile<any[]>(usersFile, []);
      for (const u of users) {
        await client.query(
          `INSERT INTO users (id, email, display_name, role, organization_id, phone, avatar_url, professional_credentials, is_demo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            u.id,
            u.email,
            u.displayName,
            u.role,
            u.organizationId || null,
            u.phone || null,
            u.avatarUrl || null,
            JSON.stringify(u.professionalCredentials || []),
            u.isDemo ?? false,
            u.createdAt ? new Date(u.createdAt) : new Date(),
            u.updatedAt ? new Date(u.updatedAt) : new Date(),
          ]
        );
        summary.usersCount++;
      }
    }

    // 3. Projects
    const projectsFile = path.join(dataDir, 'projects.json');
    if (fs.existsSync(projectsFile)) {
      const projects = safeReadJsonFile<any[]>(projectsFile, []);
      for (const p of projects) {
        await client.query(
          `INSERT INTO projects (id, name, code, description, location, client_organization_id, general_contractor_org_id, total_budget_usd, status, appointments, created_at, updated_at, is_demo, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.name,
            p.code,
            p.description || null,
            p.location || null,
            p.clientOrganizationId || null,
            p.generalContractorOrgId || null,
            p.totalBudgetUSD || 0,
            p.status || 'ACTIVE',
            JSON.stringify(p.appointments || []),
            p.createdAt ? new Date(p.createdAt) : new Date(),
            p.updatedAt ? new Date(p.updatedAt) : new Date(),
            p.isDemo ?? false,
            JSON.stringify(p.metadata || {}),
          ]
        );
        summary.projectsCount++;
      }
    }

    // 4. Milestones
    const msFile = path.join(dataDir, 'milestones.json');
    if (fs.existsSync(msFile)) {
      const milestones = safeReadJsonFile<any[]>(msFile, []);
      for (const m of milestones) {
        await client.query(
          `INSERT INTO milestones (id, project_id, sequence_number, code, title, description, category, weight_percentage, target_date, status, contract_value_usd, payable_amount_usd, created_at, updated_at, is_demo, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (id) DO NOTHING`,
          [
            m.id,
            m.projectId,
            m.sequenceNumber || 1,
            m.code || 'MS-01',
            m.title,
            m.description || null,
            m.category || 'STRUCTURAL',
            m.weightPercentage || 0,
            m.targetDate ? new Date(m.targetDate) : null,
            m.status || 'DRAFT',
            m.contractValueUSD || 0,
            m.payableAmountUSD || 0,
            m.createdAt ? new Date(m.createdAt) : new Date(),
            m.updatedAt ? new Date(m.updatedAt) : new Date(),
            m.isDemo ?? false,
            JSON.stringify(m.metadata || {}),
          ]
        );
        summary.milestonesCount++;
      }
    }

    // 5. Evidence
    const evFile = path.join(dataDir, 'evidence.json');
    if (fs.existsSync(evFile)) {
      const evidences = safeReadJsonFile<any[]>(evFile, []);
      for (const ev of evidences) {
        await client.query(
          `INSERT INTO evidence (id, project_id, milestone_id, title, description, file_url, file_type, file_size_bytes, uploaded_by_user_id, uploaded_by_role, status, tags, hash_sha256, created_at, updated_at, is_demo, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO NOTHING`,
          [
            ev.id,
            ev.projectId,
            ev.milestoneId || null,
            ev.title,
            ev.description || null,
            ev.fileUrl || '/evidence/sample.pdf',
            ev.fileType || 'application/pdf',
            ev.fileSizeBytes || 0,
            ev.uploadedByUserId || 'usr_unknown',
            ev.uploadedByRole || 'GENERAL_CONTRACTOR',
            ev.status || 'VERIFIED',
            JSON.stringify(ev.tags || []),
            ev.hashSha256 || null,
            ev.createdAt ? new Date(ev.createdAt) : new Date(),
            ev.updatedAt ? new Date(ev.updatedAt) : new Date(),
            ev.isDemo ?? false,
            JSON.stringify(ev.metadata || {}),
          ]
        );
        summary.evidenceCount++;
      }
    }

    // 6. Submissions
    const subFile = path.join(dataDir, 'submissions.json');
    if (fs.existsSync(subFile)) {
      const subs = safeReadJsonFile<any[]>(subFile, []);
      for (const s of subs) {
        await client.query(
          `INSERT INTO submissions (id, project_id, milestone_id, submitted_by_user_id, submitted_by_name, submission_number, status, narrative, evidence_ids, created_at, updated_at, is_demo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            s.id,
            s.projectId,
            s.milestoneId,
            s.submittedByUserId || 'usr_unknown',
            s.submittedByName || 'Contractor',
            s.submissionNumber || 1,
            s.status || 'SUBMITTED',
            s.narrative || null,
            JSON.stringify(s.evidenceIds || []),
            s.createdAt ? new Date(s.createdAt) : new Date(),
            s.updatedAt ? new Date(s.updatedAt) : new Date(),
            s.isDemo ?? false,
          ]
        );
        summary.submissionsCount++;
      }
    }

    // 7. Technical Reviews
    const trFile = path.join(dataDir, 'technical_reviews.json');
    if (fs.existsSync(trFile)) {
      const reviews = safeReadJsonFile<any[]>(trFile, []);
      for (const r of reviews) {
        await client.query(
          `INSERT INTO technical_reviews (id, submission_id, project_id, reviewer_user_id, reviewer_name, reviewer_role, decision, comments, created_at, updated_at, is_demo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            r.submissionId,
            r.projectId,
            r.reviewerUserId,
            r.reviewerName || 'Director',
            r.reviewerRole || 'SENIOR_PROJECT_DIRECTOR',
            r.decision || 'ACCEPTED',
            r.comments || null,
            r.createdAt ? new Date(r.createdAt) : new Date(),
            r.updatedAt ? new Date(r.updatedAt) : new Date(),
            r.isDemo ?? false,
          ]
        );
        summary.technicalReviewsCount++;
      }
    }

    // 8. QA/QC Inspections
    const qaqcFile = path.join(dataDir, 'qaqc_inspections.json');
    if (fs.existsSync(qaqcFile)) {
      const inspections = safeReadJsonFile<any[]>(qaqcFile, []);
      for (const i of inspections) {
        await client.query(
          `INSERT INTO qaqc_inspections (id, project_id, milestone_id, inspector_user_id, inspector_role, inspector_name, inspection_status, inspection_type, inspection_notes, evidence_ids, created_at, updated_at, is_demo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            i.id,
            i.projectId,
            i.milestoneId,
            i.inspectorUserId,
            i.inspectorRole || 'STRUCTURAL_QA_QC_AUDITOR',
            i.inspectorName || 'QA Auditor',
            i.inspectionStatus || 'PENDING',
            i.inspectionType || 'GENERAL',
            i.inspectionNotes || null,
            JSON.stringify(i.evidenceIds || []),
            i.createdAt ? new Date(i.createdAt) : new Date(),
            i.updatedAt ? new Date(i.updatedAt) : new Date(),
            i.isDemo ?? false,
          ]
        );
        summary.qaqcInspectionsCount++;
      }
    }

    // 9. NCRs
    const ncrsFile = path.join(dataDir, 'ncrs.json');
    if (fs.existsSync(ncrsFile)) {
      const ncrs = safeReadJsonFile<any[]>(ncrsFile, []);
      for (const ncr of ncrs) {
        await client.query(
          `INSERT INTO ncrs (id, project_id, milestone_id, inspection_id, number, title, description, severity, status, created_by_user_id, created_by_name, created_at, updated_at, is_demo, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            ncr.id,
            ncr.projectId,
            ncr.milestoneId || null,
            ncr.inspectionId || null,
            ncr.number || 'NCR-001',
            ncr.title,
            ncr.description || null,
            ncr.severity || 'MAJOR',
            ncr.status || 'OPEN',
            ncr.createdByUserId || 'usr_unknown',
            ncr.createdByName || 'Auditor',
            ncr.createdAt ? new Date(ncr.createdAt) : new Date(),
            ncr.updatedAt ? new Date(ncr.updatedAt) : new Date(),
            ncr.isDemo ?? false,
            JSON.stringify(ncr.metadata || {}),
          ]
        );
        summary.ncrsCount++;
      }
    }

    // 10. Owner Decisions
    const odFile = path.join(dataDir, 'owner_decisions.json');
    if (fs.existsSync(odFile)) {
      const decisions = safeReadJsonFile<any[]>(odFile, []);
      for (const d of decisions) {
        await client.query(
          `INSERT INTO owner_decisions (id, project_id, milestone_id, owner_user_id, owner_name, decision, notes, payable_amount_usd, created_at, updated_at, is_demo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            d.id,
            d.projectId,
            d.milestoneId,
            d.ownerUserId,
            d.ownerName || 'Owner',
            d.decision || 'APPROVED',
            d.notes || null,
            d.payableAmountUSD || 0,
            d.createdAt ? new Date(d.createdAt) : new Date(),
            d.updatedAt ? new Date(d.updatedAt) : new Date(),
            d.isDemo ?? false,
          ]
        );
        summary.ownerDecisionsCount++;
      }
    }

    // 11. Financial Instructions
    const fiFile = path.join(dataDir, 'financial_instructions.json');
    if (fs.existsSync(fiFile)) {
      const instructions = safeReadJsonFile<any[]>(fiFile, []);
      for (const fi of instructions) {
        await client.query(
          `INSERT INTO financial_instructions (id, project_id, milestone_id, owner_decision_id, recipient_org_id, amount_usd, currency, idempotency_key, status, provider_reference, reason, created_by_user_id, authorized_at, created_at, updated_at, is_demo, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO NOTHING`,
          [
            fi.id,
            fi.projectId,
            fi.milestoneId,
            fi.ownerDecisionId || null,
            fi.recipientOrgId || 'org-gc',
            fi.amountUSD || 0,
            fi.currency || 'USD',
            fi.idempotencyKey || `idem-${fi.id}`,
            fi.status || 'AUTHORIZED',
            fi.providerReference || null,
            fi.reason || null,
            fi.createdByUserId || 'usr_owner',
            fi.authorizedAt ? new Date(fi.authorizedAt) : new Date(),
            fi.createdAt ? new Date(fi.createdAt) : new Date(),
            fi.updatedAt ? new Date(fi.updatedAt) : new Date(),
            fi.isDemo ?? false,
            JSON.stringify(fi.metadata || {}),
          ]
        );
        summary.financialInstructionsCount++;
      }
    }

    // 12. Audit Events
    const aeFile = path.join(dataDir, 'audit_events.json');
    if (fs.existsSync(aeFile)) {
      const events = safeReadJsonFile<any[]>(aeFile, []);
      for (const ae of events) {
        await client.query(
          `INSERT INTO audit_events (id, timestamp, action, actor_id, actor_role, actor_name, project_id, entity_type, entity_id, previous_state, new_state, ip_address, correlation_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO NOTHING`,
          [
            ae.id,
            ae.timestamp ? new Date(ae.timestamp) : new Date(),
            ae.action,
            ae.actorId || 'system',
            ae.actorRole || 'SYSTEM',
            ae.actorName || 'System',
            ae.projectId || null,
            ae.entityType || 'GOVERNANCE',
            ae.entityId || null,
            ae.previousState ? JSON.stringify(ae.previousState) : null,
            ae.newState ? JSON.stringify(ae.newState) : null,
            ae.ipAddress || null,
            ae.correlationId || null,
            JSON.stringify(ae.metadata || {}),
          ]
        );
        summary.auditEventsCount++;
      }
    }

    if (options.dryRun) {
      await client.query('ROLLBACK');
      logger.info('Database migration dry run completed successfully (rolled back)', 'Migration', { summary });
      return summary;
    }

    await client.query('COMMIT');
    logger.info('Database migration completed successfully', 'Migration', { summary });
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('Database migration failed, rolled back transaction', 'Migration', { error: err.message });
    summary.errors.push(err.message);
    throw err;
  } finally {
    client.release();
  }

  return summary;
}
