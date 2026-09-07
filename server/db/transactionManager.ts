import { dbManager } from './database';
import { AuditEvent } from '../repositories/auditEventRepository';
import {
  FinancialInstruction,
  OwnerMilestoneDecision,
  QAQCInspection,
  NonConformanceReport,
} from '../../src/types';
import { logger } from '../utils/logger';

export class TransactionManager {
  /**
   * Atomic financial authorization transaction:
   * 1. Updates milestone status and financial flags
   * 2. Creates financial instruction with idempotency key
   * 3. Records immutable AuditEvent
   */
  public async executeFinancialAuthorizationTx(params: {
    milestoneId: string;
    instruction: FinancialInstruction;
    auditEvent: AuditEvent;
  }): Promise<{ instruction: FinancialInstruction; auditEvent: AuditEvent }> {
    return await dbManager.withTransaction(async (client) => {
      // 1. Update milestone
      await client.query(
        `UPDATE milestones
         SET status = 'APPROVED',
             updated_at = NOW()
         WHERE id = $1`,
        [params.milestoneId]
      );

      // 2. Insert financial instruction
      await client.query(
        `INSERT INTO financial_instructions (
          id, project_id, milestone_id, owner_decision_id, recipient_org_id,
          amount_usd, currency, idempotency_key, status, provider_reference,
          reason, created_by_user_id, authorized_at, created_at, updated_at, is_demo, metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          provider_reference = EXCLUDED.provider_reference,
          updated_at = EXCLUDED.updated_at,
          metadata = EXCLUDED.metadata`,
        [
          params.instruction.id,
          params.instruction.projectId,
          params.instruction.milestoneId,
          params.instruction.ownerDecisionId || null,
          params.instruction.contractorUserId || 'usr_gc',
          params.instruction.amountUSD || 0,
          params.instruction.currency || 'USD',
          params.instruction.idempotencyKey,
          params.instruction.status,
          params.instruction.providerReference || null,
          params.instruction.executionNotes || null,
          params.instruction.createdByUserId,
          params.instruction.createdAt ? new Date(params.instruction.createdAt) : new Date(),
          params.instruction.createdAt ? new Date(params.instruction.createdAt) : new Date(),
          params.instruction.updatedAt ? new Date(params.instruction.updatedAt) : new Date(),
          params.instruction.isDemo ?? false,
          JSON.stringify(params.instruction),
        ]
      );

      // 3. Record AuditEvent
      await client.query(
        `INSERT INTO audit_events (
          id, timestamp, action, actor_user_id, organization_id,
          project_id, entity_type, entity_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          params.auditEvent.id,
          new Date(params.auditEvent.timestamp),
          params.auditEvent.action,
          params.auditEvent.actorUserId,
          params.auditEvent.organizationId || null,
          params.auditEvent.projectId || null,
          params.auditEvent.entityType,
          params.auditEvent.entityId || null,
          JSON.stringify(params.auditEvent.metadata || {}),
        ]
      );

      logger.info('Financial authorization transaction executed successfully', 'TransactionManager', {
        instructionId: params.instruction.id,
        milestoneId: params.milestoneId,
      });

      return {
        instruction: params.instruction,
        auditEvent: params.auditEvent,
      };
    });
  }

  /**
   * Atomic Owner decision transaction:
   * 1. Inserts owner_decisions row
   * 2. Updates milestone owner decision status
   * 3. Records immutable AuditEvent
   */
  public async executeOwnerDecisionTx(params: {
    decision: OwnerMilestoneDecision;
    newMilestoneStatus?: string;
    auditEvent: AuditEvent;
  }): Promise<{ decision: OwnerMilestoneDecision; auditEvent: AuditEvent }> {
    return await dbManager.withTransaction(async (client) => {
      // 1. Insert decision
      await client.query(
        `INSERT INTO owner_decisions (
          id, project_id, milestone_id, owner_user_id,
          owner_name, decision, notes, payable_amount_usd,
          created_at, updated_at, is_demo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          decision = EXCLUDED.decision,
          notes = EXCLUDED.notes,
          payable_amount_usd = EXCLUDED.payable_amount_usd,
          updated_at = EXCLUDED.updated_at`,
        [
          params.decision.id,
          params.decision.projectId,
          params.decision.milestoneId,
          params.decision.decidedByUserId,
          params.decision.decidedByName,
          params.decision.decision,
          params.decision.decisionNotes || null,
          0,
          params.decision.createdAt ? new Date(params.decision.createdAt) : new Date(),
          params.decision.decidedAt ? new Date(params.decision.decidedAt) : new Date(),
          params.decision.isDemo ?? false,
        ]
      );

      // 2. Update milestone
      if (params.newMilestoneStatus) {
        await client.query(
          `UPDATE milestones
           SET status = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [params.newMilestoneStatus, params.decision.milestoneId]
        );
      }

      // 3. Record AuditEvent
      await client.query(
        `INSERT INTO audit_events (
          id, timestamp, action, actor_user_id, organization_id,
          project_id, entity_type, entity_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          params.auditEvent.id,
          new Date(params.auditEvent.timestamp),
          params.auditEvent.action,
          params.auditEvent.actorUserId,
          params.auditEvent.organizationId || null,
          params.auditEvent.projectId || null,
          params.auditEvent.entityType,
          params.auditEvent.entityId || null,
          JSON.stringify(params.auditEvent.metadata || {}),
        ]
      );

      return {
        decision: params.decision,
        auditEvent: params.auditEvent,
      };
    });
  }

  /**
   * Atomic QA/QC inspection outcome transaction:
   * 1. Updates inspection record
   * 2. Updates milestone QA/QC status
   * 3. Records immutable AuditEvent
   */
  public async executeQaqcDecisionTx(params: {
    inspection: QAQCInspection;
    qaqcMilestoneStatus: string;
    auditEvent: AuditEvent;
  }): Promise<{ inspection: QAQCInspection; auditEvent: AuditEvent }> {
    return await dbManager.withTransaction(async (client) => {
      // 1. Update/insert inspection
      await client.query(
        `INSERT INTO qaqc_inspections (
          id, project_id, milestone_id, inspector_user_id,
          inspector_role, inspector_name, inspection_status,
          inspection_type, inspection_notes, evidence_ids,
          created_at, updated_at, is_demo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          inspection_status = EXCLUDED.inspection_status,
          inspection_type = EXCLUDED.inspection_type,
          inspection_notes = EXCLUDED.inspection_notes,
          evidence_ids = EXCLUDED.evidence_ids,
          updated_at = EXCLUDED.updated_at`,
        [
          params.inspection.id,
          params.inspection.projectId,
          params.inspection.milestoneId,
          params.inspection.inspectorUserId,
          params.inspection.inspectorRole,
          params.inspection.inspectorName,
          params.inspection.inspectionStatus,
          params.inspection.inspectionType || 'GENERAL',
          params.inspection.inspectionNotes || null,
          JSON.stringify(params.inspection.evidenceIds || []),
          params.inspection.createdAt ? new Date(params.inspection.createdAt) : new Date(),
          params.inspection.updatedAt ? new Date(params.inspection.updatedAt) : new Date(),
          params.inspection.isDemo ?? false,
        ]
      );

      // 2. Update milestone status
      await client.query(
        `UPDATE milestones
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [params.qaqcMilestoneStatus, params.inspection.milestoneId]
      );

      // 3. Record AuditEvent
      await client.query(
        `INSERT INTO audit_events (
          id, timestamp, action, actor_user_id, organization_id,
          project_id, entity_type, entity_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          params.auditEvent.id,
          new Date(params.auditEvent.timestamp),
          params.auditEvent.action,
          params.auditEvent.actorUserId,
          params.auditEvent.organizationId || null,
          params.auditEvent.projectId || null,
          params.auditEvent.entityType,
          params.auditEvent.entityId || null,
          JSON.stringify(params.auditEvent.metadata || {}),
        ]
      );

      return {
        inspection: params.inspection,
        auditEvent: params.auditEvent,
      };
    });
  }

  /**
   * Atomic NCR resolution transaction:
   * 1. Updates NCR status to CLOSED
   * 2. Clears active NCR from milestone and updates status
   * 3. Records immutable AuditEvent
   */
  public async executeNcrResolutionTx(params: {
    ncr: NonConformanceReport;
    milestoneId: string;
    auditEvent: AuditEvent;
  }): Promise<{ ncr: NonConformanceReport; auditEvent: AuditEvent }> {
    return await dbManager.withTransaction(async (client) => {
      // 1. Update NCR
      await client.query(
        `UPDATE ncrs
         SET status = 'CLOSED',
             updated_at = NOW(),
             metadata = $1
         WHERE id = $2`,
        [
          JSON.stringify(params.ncr),
          params.ncr.id,
        ]
      );

      // 2. Update milestone
      await client.query(
        `UPDATE milestones
         SET status = 'QA_QC_PASSED',
             updated_at = NOW()
         WHERE id = $1`,
        [params.milestoneId]
      );

      // 3. Record AuditEvent
      await client.query(
        `INSERT INTO audit_events (
          id, timestamp, action, actor_user_id, organization_id,
          project_id, entity_type, entity_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
          params.auditEvent.id,
          new Date(params.auditEvent.timestamp),
          params.auditEvent.action,
          params.auditEvent.actorUserId,
          params.auditEvent.organizationId || null,
          params.auditEvent.projectId || null,
          params.auditEvent.entityType,
          params.auditEvent.entityId || null,
          JSON.stringify(params.auditEvent.metadata || {}),
        ]
      );

      return {
        ncr: params.ncr,
        auditEvent: params.auditEvent,
      };
    });
  }
}

export const transactionManager = new TransactionManager();
