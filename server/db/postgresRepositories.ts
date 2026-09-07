/**
 * STRUCTURA — PostgreSQL Repository Implementations
 * SPRINT 06B: Production Infrastructure & Database Persistence
 *
 * Provides production PostgreSQL implementations for all Structura repositories
 * conforming strictly to the repository interfaces and domain types.
 */

import { dbManager } from './database';
import {
  ProjectMilestone,
  ProjectEvidence,
  ContractorMilestoneSubmission,
  ProjectDirectorTechnicalReview,
  QAQCInspection,
  NonConformanceReport,
  OwnerMilestoneDecision,
  ProjectDecision,
  RFI,
  ProjectConversation,
  ProjectMessage,
  ProjectNotification,
  ProjectCloseout,
  CloseoutChecklistItem,
  PunchItem,
  ProjectHandover,
  HandoverChecklistItem,
  FinancialInstruction,
  AIInspectionAnalysis,
  ChannelType,
  DirectLineMessageType,
  ProjectRole,
} from '../../src/types';

import { UserProfile, IUserRepository } from '../repositories/userRepository';
import { Organization, OrganizationMembership, IOrganizationRepository } from '../repositories/organizationRepository';
import { StoredProject, ProjectAppointment, IProjectRepository } from '../repositories/projectRepository';
import { IMilestoneRepository } from '../repositories/milestoneRepository';
import { IEvidenceRepository } from '../repositories/evidenceRepository';
import { ISubmissionRepository } from '../repositories/submissionRepository';
import { ITechnicalReviewRepository } from '../repositories/technicalReviewRepository';
import { IQAQCInspectionRepository } from '../repositories/qaqcRepository';
import { INCRRepository } from '../repositories/ncrRepository';
import { IOwnerDecisionRepository } from '../repositories/ownerDecisionRepository';
import { IProjectDecisionRepository } from '../repositories/projectDecisionRepository';
import { IRFIRepository } from '../repositories/rfiRepository';
import { IDirectLineRepository } from '../repositories/directLineRepository';
import { INotificationRepository } from '../repositories/notificationRepository';
import { ICloseoutRepository } from '../repositories/closeoutRepository';
import { IPunchItemRepository } from '../repositories/punchItemRepository';
import { IHandoverRepository } from '../repositories/handoverRepository';
import { IFinancialInstructionRepository } from '../repositories/financialInstructionRepository';
import { IAuditEventRepository, AuditEvent } from '../repositories/auditEventRepository';
import { IAIInspectionRepository } from '../repositories/aiInspectionRepository';

// ==========================================================
// 1. Postgres User Repository
// ==========================================================
export class PostgresUserRepository implements IUserRepository {
  async create(profile: UserProfile): Promise<UserProfile> {
    await dbManager.query(
      `INSERT INTO users (id, auth_user_id, email, first_name, last_name, phone, primary_role, account_status, identity_status, professional_verification_status, role_details, is_demo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         auth_user_id = EXCLUDED.auth_user_id,
         email = EXCLUDED.email,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone,
         primary_role = EXCLUDED.primary_role,
         account_status = EXCLUDED.account_status,
         identity_status = EXCLUDED.identity_status,
         professional_verification_status = EXCLUDED.professional_verification_status,
         role_details = EXCLUDED.role_details,
         is_demo = EXCLUDED.is_demo,
         updated_at = EXCLUDED.updated_at`,
      [
        profile.id,
        profile.authUserId || profile.id,
        profile.email.toLowerCase().trim(),
        profile.firstName,
        profile.lastName,
        profile.phone || '',
        profile.primaryRole,
        profile.accountStatus,
        profile.identityStatus,
        profile.professionalVerificationStatus,
        JSON.stringify(profile.roleDetails || {}),
        profile.isDemo ?? false,
        profile.createdAt ? new Date(profile.createdAt) : new Date(),
        profile.updatedAt ? new Date(profile.updatedAt) : new Date(),
      ]
    );
    return profile;
  }

  async findById(id: string): Promise<UserProfile | null> {
    const res = await dbManager.query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapUser(res.rows[0]);
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfile | null> {
    const res = await dbManager.query('SELECT * FROM users WHERE auth_user_id = $1', [authUserId]);
    if (res.rows.length === 0) {
      const byId = await this.findById(authUserId);
      return byId;
    }
    return this.mapUser(res.rows[0]);
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const res = await dbManager.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
    if (res.rows.length === 0) return null;
    return this.mapUser(res.rows[0]);
  }

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const current = await this.findById(id);
    if (!current) return null;
    const updated: UserProfile = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.create(updated);
    return updated;
  }

  async listAll(): Promise<UserProfile[]> {
    const res = await dbManager.query('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(r => this.mapUser(r));
  }

  private mapUser(row: any): UserProfile {
    const details = typeof row.role_details === 'string' ? JSON.parse(row.role_details) : (row.role_details || {});
    return {
      id: row.id,
      authUserId: row.auth_user_id || row.id,
      email: row.email,
      firstName: row.first_name || (row.display_name ? row.display_name.split(' ')[0] : 'User'),
      lastName: row.last_name || (row.display_name ? row.display_name.split(' ').slice(1).join(' ') : ''),
      phone: row.phone || '',
      primaryRole: row.primary_role || row.role || 'OWNER_CLIENT',
      accountStatus: row.account_status || 'ACTIVE',
      identityStatus: row.identity_status || 'NOT_STARTED',
      professionalVerificationStatus: row.professional_verification_status || 'NOT_REQUIRED',
      roleDetails: details,
      isDemo: Boolean(row.is_demo),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}

// ==========================================================
// 2. Postgres Organization Repository
// ==========================================================
export class PostgresOrganizationRepository implements IOrganizationRepository {
  async createOrganization(org: Organization): Promise<Organization> {
    await dbManager.query(
      `INSERT INTO organizations (id, name, type, registration_number, jurisdiction, country, address, created_by_user_id, owner_user_id, verification_status, owner_authority_status, status, created_at, updated_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         registration_number = EXCLUDED.registration_number,
         jurisdiction = EXCLUDED.jurisdiction,
         country = EXCLUDED.country,
         address = EXCLUDED.address,
         created_by_user_id = EXCLUDED.created_by_user_id,
         owner_user_id = EXCLUDED.owner_user_id,
         verification_status = EXCLUDED.verification_status,
         owner_authority_status = EXCLUDED.owner_authority_status,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         is_demo = EXCLUDED.is_demo`,
      [
        org.id,
        org.name,
        org.type,
        org.registrationNumber || null,
        org.jurisdiction || 'US',
        org.country || 'USA',
        org.address || null,
        org.createdByUserId || null,
        org.ownerUserId || null,
        org.verificationStatus || 'NOT_STARTED',
        org.ownerAuthorityStatus || 'NOT_STARTED',
        org.status || 'ACTIVE',
        org.createdAt ? new Date(org.createdAt) : new Date(),
        org.updatedAt ? new Date(org.updatedAt) : new Date(),
        org.isDemo ?? false,
      ]
    );
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const res = await dbManager.query('SELECT * FROM organizations WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapOrg(res.rows[0]);
  }

  async listOrganizationsByUser(userId: string): Promise<Organization[]> {
    const memberships = await this.listMembershipsByUser(userId);
    const orgIds = memberships.map(m => m.organizationId);
    if (orgIds.length === 0) {
      const res = await dbManager.query('SELECT * FROM organizations WHERE owner_user_id = $1 OR created_by_user_id = $1', [userId]);
      return res.rows.map(r => this.mapOrg(r));
    }
    const res = await dbManager.query('SELECT * FROM organizations WHERE id = ANY($1) OR owner_user_id = $2 OR created_by_user_id = $2', [orgIds, userId]);
    return res.rows.map(r => this.mapOrg(r));
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    const current = await this.getOrganizationById(id);
    if (!current) return null;
    const updated: Organization = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createOrganization(updated);
    return updated;
  }

  async createMembership(membership: OrganizationMembership): Promise<OrganizationMembership> {
    await dbManager.query(
      `INSERT INTO organization_memberships (id, organization_id, user_id, organization_role, status, invited_by_user_id, invited_at, accepted_at, created_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         organization_role = EXCLUDED.organization_role,
         status = EXCLUDED.status,
         accepted_at = EXCLUDED.accepted_at`,
      [
        membership.id,
        membership.organizationId,
        membership.userId,
        membership.organizationRole,
        membership.status || 'ACTIVE',
        membership.invitedByUserId || null,
        membership.invitedAt ? new Date(membership.invitedAt) : null,
        membership.acceptedAt ? new Date(membership.acceptedAt) : null,
        membership.createdAt ? new Date(membership.createdAt) : new Date(),
        membership.isDemo ?? false,
      ]
    );
    return membership;
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null> {
    const res = await dbManager.query(
      'SELECT * FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
      [organizationId, userId]
    );
    if (res.rows.length === 0) return null;
    return this.mapMembership(res.rows[0]);
  }

  async listMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]> {
    const res = await dbManager.query('SELECT * FROM organization_memberships WHERE organization_id = $1', [organizationId]);
    return res.rows.map(r => this.mapMembership(r));
  }

  async listMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    const res = await dbManager.query('SELECT * FROM organization_memberships WHERE user_id = $1', [userId]);
    return res.rows.map(r => this.mapMembership(r));
  }

  private mapOrg(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      registrationNumber: row.registration_number || undefined,
      jurisdiction: row.jurisdiction || 'US',
      country: row.country || 'USA',
      address: row.address || undefined,
      createdByUserId: row.created_by_user_id || undefined,
      ownerUserId: row.owner_user_id || undefined,
      verificationStatus: row.verification_status || 'NOT_STARTED',
      ownerAuthorityStatus: row.owner_authority_status || 'NOT_STARTED',
      status: row.status || 'ACTIVE',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }

  private mapMembership(row: any): OrganizationMembership {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      organizationRole: row.organization_role || row.role || 'MEMBER',
      status: row.status || 'ACTIVE',
      invitedByUserId: row.invited_by_user_id || undefined,
      invitedAt: row.invited_at instanceof Date ? row.invited_at.toISOString() : (row.invited_at || undefined),
      acceptedAt: row.accepted_at instanceof Date ? row.accepted_at.toISOString() : (row.accepted_at || undefined),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 3. Postgres Project Repository
// ==========================================================
export class PostgresProjectRepository implements IProjectRepository {
  async createProject(project: StoredProject): Promise<StoredProject> {
    await dbManager.query(
      `INSERT INTO projects (id, organization_id, name, location, project_type, description, start_date, target_handover_date, total_baseline_budget_usd, currency, current_stage, owner_user_id, status, created_at, updated_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         name = EXCLUDED.name,
         location = EXCLUDED.location,
         project_type = EXCLUDED.project_type,
         description = EXCLUDED.description,
         start_date = EXCLUDED.start_date,
         target_handover_date = EXCLUDED.target_handover_date,
         total_baseline_budget_usd = EXCLUDED.total_baseline_budget_usd,
         currency = EXCLUDED.currency,
         current_stage = EXCLUDED.current_stage,
         owner_user_id = EXCLUDED.owner_user_id,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         is_demo = EXCLUDED.is_demo`,
      [
        project.id,
        project.organizationId,
        project.name,
        project.location,
        project.projectType,
        project.description || '',
        project.startDate ? new Date(project.startDate) : new Date(),
        project.targetHandoverDate ? new Date(project.targetHandoverDate) : new Date(),
        project.totalBaselineBudgetUSD || 0,
        project.currency || 'USD',
        project.currentStage || 'CONSTRUCTION',
        project.ownerUserId,
        project.status || 'ACTIVE',
        project.createdAt ? new Date(project.createdAt) : new Date(),
        project.updatedAt ? new Date(project.updatedAt) : new Date(),
        project.isDemo ?? false,
      ]
    );
    return project;
  }

  async getProjectById(id: string): Promise<StoredProject | null> {
    const res = await dbManager.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapProject(res.rows[0]);
  }

  async listProjectsByOrg(organizationId: string): Promise<StoredProject[]> {
    const res = await dbManager.query('SELECT * FROM projects WHERE organization_id = $1 ORDER BY created_at ASC', [organizationId]);
    return res.rows.map(r => this.mapProject(r));
  }

  async listProjectsByUser(userId: string): Promise<StoredProject[]> {
    const appts = await this.listAppointmentsByUser(userId);
    const projIds = appts.map(a => a.projectId);
    if (projIds.length === 0) {
      const res = await dbManager.query('SELECT * FROM projects WHERE owner_user_id = $1 ORDER BY created_at ASC', [userId]);
      return res.rows.map(r => this.mapProject(r));
    }
    const res = await dbManager.query('SELECT * FROM projects WHERE id = ANY($1) OR owner_user_id = $2 ORDER BY created_at ASC', [projIds, userId]);
    return res.rows.map(r => this.mapProject(r));
  }

  async updateProject(id: string, updates: Partial<StoredProject>): Promise<StoredProject | null> {
    const current = await this.getProjectById(id);
    if (!current) return null;
    const updated: StoredProject = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createProject(updated);
    return updated;
  }

  async createAppointment(appointment: ProjectAppointment): Promise<ProjectAppointment> {
    await dbManager.query(
      `INSERT INTO project_appointments (id, project_id, organization_id, user_id, user_email, user_name, role, discipline, appointment_status, invited_by_user_id, invited_at, responded_at, activated_at, ended_at, reason, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         discipline = EXCLUDED.discipline,
         appointment_status = EXCLUDED.appointment_status,
         responded_at = EXCLUDED.responded_at,
         activated_at = EXCLUDED.activated_at,
         ended_at = EXCLUDED.ended_at,
         reason = EXCLUDED.reason`,
      [
        appointment.id,
        appointment.projectId,
        appointment.organizationId,
        appointment.userId,
        appointment.userEmail || null,
        appointment.userName || null,
        appointment.role,
        appointment.discipline || null,
        appointment.appointmentStatus,
        appointment.invitedByUserId,
        appointment.invitedAt ? new Date(appointment.invitedAt) : new Date(),
        appointment.respondedAt ? new Date(appointment.respondedAt) : null,
        appointment.activatedAt ? new Date(appointment.activatedAt) : null,
        appointment.endedAt ? new Date(appointment.endedAt) : null,
        appointment.reason || null,
        appointment.isDemo ?? false,
      ]
    );
    return appointment;
  }

  async getAppointmentById(id: string): Promise<ProjectAppointment | null> {
    const res = await dbManager.query('SELECT * FROM project_appointments WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapAppointment(res.rows[0]);
  }

  async getAppointmentByProjectAndUser(projectId: string, userId: string): Promise<ProjectAppointment | null> {
    const res = await dbManager.query(
      'SELECT * FROM project_appointments WHERE project_id = $1 AND user_id = $2 AND appointment_status = $3 LIMIT 1',
      [projectId, userId, 'ACTIVE']
    );
    if (res.rows.length === 0) {
      const anyRes = await dbManager.query(
        'SELECT * FROM project_appointments WHERE project_id = $1 AND user_id = $2 ORDER BY invited_at DESC LIMIT 1',
        [projectId, userId]
      );
      if (anyRes.rows.length === 0) return null;
      return this.mapAppointment(anyRes.rows[0]);
    }
    return this.mapAppointment(res.rows[0]);
  }

  async listAppointmentsByProject(projectId: string): Promise<ProjectAppointment[]> {
    const res = await dbManager.query('SELECT * FROM project_appointments WHERE project_id = $1', [projectId]);
    return res.rows.map(r => this.mapAppointment(r));
  }

  async listAppointmentsByUser(userId: string): Promise<ProjectAppointment[]> {
    const res = await dbManager.query('SELECT * FROM project_appointments WHERE user_id = $1', [userId]);
    return res.rows.map(r => this.mapAppointment(r));
  }

  async updateAppointment(id: string, updates: Partial<ProjectAppointment>): Promise<ProjectAppointment | null> {
    const current = await this.getAppointmentById(id);
    if (!current) return null;
    const updated: ProjectAppointment = {
      ...current,
      ...updates,
    };
    await this.createAppointment(updated);
    return updated;
  }

  private mapProject(row: any): StoredProject {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      location: row.location || '',
      projectType: row.project_type || 'COMMERCIAL',
      description: row.description || '',
      startDate: row.start_date instanceof Date ? row.start_date.toISOString() : String(row.start_date || ''),
      targetHandoverDate: row.target_handover_date instanceof Date ? row.target_handover_date.toISOString() : String(row.target_handover_date || ''),
      totalBaselineBudgetUSD: Number(row.total_baseline_budget_usd) || 0,
      currency: row.currency || 'USD',
      currentStage: row.current_stage || 'CONSTRUCTION',
      ownerUserId: row.owner_user_id || '',
      status: row.status || 'ACTIVE',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }

  private mapAppointment(row: any): ProjectAppointment {
    return {
      id: row.id,
      projectId: row.project_id,
      organizationId: row.organization_id,
      userId: row.user_id,
      userEmail: row.user_email || undefined,
      userName: row.user_name || undefined,
      role: row.role || row.project_role,
      discipline: row.discipline || undefined,
      appointmentStatus: row.appointment_status || row.status || 'ACTIVE',
      invitedByUserId: row.invited_by_user_id || 'usr_owner',
      invitedAt: row.invited_at instanceof Date ? row.invited_at.toISOString() : String(row.invited_at || ''),
      respondedAt: row.responded_at instanceof Date ? row.responded_at.toISOString() : (row.responded_at || undefined),
      activatedAt: row.activated_at instanceof Date ? row.activated_at.toISOString() : (row.activated_at || undefined),
      endedAt: row.ended_at instanceof Date ? row.ended_at.toISOString() : (row.ended_at || undefined),
      reason: row.reason || undefined,
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 4. Postgres Milestone Repository
// ==========================================================
export class PostgresMilestoneRepository implements IMilestoneRepository {
  async createMilestone(milestone: ProjectMilestone): Promise<ProjectMilestone> {
    await dbManager.query(
      `INSERT INTO milestones (id, project_id, name, phase_order, planned_start_date, planned_end_date, actual_end_date, status, progress_percentage, cost_allocation_usd, financial_status, qa_qc_status, owner_decision_status, payout_approved, escrow_status, active_inspection_id, active_ncr_id, created_at, updated_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         phase_order = EXCLUDED.phase_order,
         planned_start_date = EXCLUDED.planned_start_date,
         planned_end_date = EXCLUDED.planned_end_date,
         actual_end_date = EXCLUDED.actual_end_date,
         status = EXCLUDED.status,
         progress_percentage = EXCLUDED.progress_percentage,
         cost_allocation_usd = EXCLUDED.cost_allocation_usd,
         financial_status = EXCLUDED.financial_status,
         qa_qc_status = EXCLUDED.qa_qc_status,
         owner_decision_status = EXCLUDED.owner_decision_status,
         active_inspection_id = EXCLUDED.active_inspection_id,
         active_ncr_id = EXCLUDED.active_ncr_id,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        milestone.id,
        milestone.projectId,
        milestone.title,
        milestone.sequence || 1,
        milestone.plannedStartDate || null,
        milestone.plannedEndDate || null,
        null,
        milestone.status || 'NOT_STARTED',
        milestone.progressPercentage || 0,
        milestone.costAllocationUSD || 0,
        milestone.financialStatus || 'AWAITING_GOVERNANCE',
        milestone.qaQcStatus || 'PENDING',
        milestone.ownerDecisionStatus || 'PENDING',
        false,
        'Not Reached',
        milestone.activeInspectionId || null,
        milestone.activeNcrId || null,
        milestone.createdAt ? new Date(milestone.createdAt) : new Date(),
        milestone.updatedAt ? new Date(milestone.updatedAt) : new Date(),
        JSON.stringify(milestone),
      ]
    );
    return milestone;
  }

  async getMilestoneById(id: string): Promise<ProjectMilestone | null> {
    const res = await dbManager.query('SELECT * FROM milestones WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapMilestone(res.rows[0]);
  }

  async listMilestonesByProject(projectId: string): Promise<ProjectMilestone[]> {
    const res = await dbManager.query('SELECT * FROM milestones WHERE project_id = $1 ORDER BY phase_order ASC', [projectId]);
    return res.rows.map(r => this.mapMilestone(r));
  }

  async getMilestonesByProjectId(projectId: string): Promise<ProjectMilestone[]> {
    return this.listMilestonesByProject(projectId);
  }

  async updateMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<ProjectMilestone> {
    const current = await this.getMilestoneById(id);
    if (!current) throw new Error(`Milestone ${id} not found`);
    const updated: ProjectMilestone = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createMilestone(updated);
    return updated;
  }

  private mapMilestone(row: any): ProjectMilestone {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.name || row.title || meta.title || 'Milestone',
      description: row.description || meta.description || '',
      sequence: Number(row.phase_order || row.sequence || meta.sequence || 1),
      discipline: meta.discipline || 'Structural',
      status: row.status,
      requiresProjectDirectorReview: meta.requiresProjectDirectorReview ?? true,
      requiresQaQcReview: meta.requiresQaQcReview ?? true,
      requiresOwnerApproval: meta.requiresOwnerApproval ?? true,
      contractorSubmissionStatus: meta.contractorSubmissionStatus || 'NONE',
      technicalReviewStatus: meta.technicalReviewStatus || 'NONE',
      qaQcStatus: row.qa_qc_status || meta.qaQcStatus || 'PENDING',
      ownerDecisionStatus: row.owner_decision_status || meta.ownerDecisionStatus || 'PENDING',
      financialStatus: row.financial_status || meta.financialStatus || 'AWAITING_GOVERNANCE',
      plannedStartDate: row.planned_start_date || meta.plannedStartDate || undefined,
      plannedEndDate: row.planned_end_date || meta.plannedEndDate || undefined,
      costAllocationUSD: Number(row.cost_allocation_usd) || meta.costAllocationUSD || 0,
      progressPercentage: Number(row.progress_percentage) || meta.progressPercentage || 0,
      relatedEvidenceIds: meta.relatedEvidenceIds || [],
      activeSubmissionId: meta.activeSubmissionId,
      activeInspectionId: row.active_inspection_id || meta.activeInspectionId || undefined,
      activeNcrId: row.active_ncr_id || meta.activeNcrId || undefined,
      createdByUserId: meta.createdByUserId || 'usr_demo_director',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo ?? meta.isDemo),
    };
  }
}

// ==========================================================
// 5. Postgres Evidence Repository
// ==========================================================
export class PostgresEvidenceRepository implements IEvidenceRepository {
  async createEvidence(evidence: ProjectEvidence): Promise<ProjectEvidence> {
    await dbManager.query(
      `INSERT INTO evidence (id, project_id, milestone_id, title, description, file_url, file_type, file_size_bytes, uploaded_by_user_id, uploaded_by_role, status, tags, hash_sha256, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         milestone_id = EXCLUDED.milestone_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         file_url = EXCLUDED.file_url,
         status = EXCLUDED.status,
         tags = EXCLUDED.tags,
         hash_sha256 = EXCLUDED.hash_sha256,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        evidence.id,
        evidence.projectId,
        evidence.milestoneId || null,
        evidence.title,
        evidence.description || null,
        evidence.fileName || '',
        evidence.mimeType || evidence.evidenceType || 'SITE_PHOTO',
        evidence.fileSize || 0,
        evidence.uploadedByUserId,
        evidence.uploadedByRole,
        evidence.storageStatus || 'VERIFIED',
        JSON.stringify([]),
        evidence.storageReference || null,
        evidence.createdAt ? new Date(evidence.createdAt) : new Date(),
        evidence.updatedAt ? new Date(evidence.updatedAt) : new Date(),
        evidence.isDemo ?? false,
        JSON.stringify(evidence.metadata || {}),
      ]
    );
    return evidence;
  }

  async getEvidenceById(id: string): Promise<ProjectEvidence | null> {
    const res = await dbManager.query('SELECT * FROM evidence WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapEvidence(res.rows[0]);
  }

  async listEvidenceByProject(projectId: string): Promise<ProjectEvidence[]> {
    const res = await dbManager.query('SELECT * FROM evidence WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapEvidence(r));
  }

  async listEvidenceByMilestone(projectId: string, milestoneId: string): Promise<ProjectEvidence[]> {
    const res = await dbManager.query('SELECT * FROM evidence WHERE project_id = $1 AND milestone_id = $2 ORDER BY created_at DESC', [projectId, milestoneId]);
    return res.rows.map(r => this.mapEvidence(r));
  }

  async updateEvidence(id: string, updates: Partial<ProjectEvidence>): Promise<ProjectEvidence> {
    const current = await this.getEvidenceById(id);
    if (!current) throw new Error(`Evidence ${id} not found`);
    const updated: ProjectEvidence = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createEvidence(updated);
    return updated;
  }

  private mapEvidence(row: any): ProjectEvidence {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id || undefined,
      uploadedByUserId: row.uploaded_by_user_id,
      uploadedByRole: row.uploaded_by_role || 'GENERAL_CONTRACTOR',
      uploadedByName: row.uploaded_by_name || 'Project Member',
      evidenceType: row.evidence_type || 'SITE_PHOTO',
      title: row.title,
      description: row.description || '',
      fileName: row.file_url || row.file_name || 'evidence.bin',
      mimeType: row.file_type || row.mime_type || 'application/octet-stream',
      fileSize: Number(row.file_size_bytes || row.file_size) || 0,
      storageProvider: row.storage_provider || 'METADATA_ONLY',
      storageStatus: row.status || row.storage_status || 'RECORDED_METADATA',
      storageReference: row.hash_sha256 || row.storage_reference || row.id,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
      metadata: meta,
    };
  }
}

// ==========================================================
// 6. Postgres Submission Repository
// ==========================================================
export class PostgresSubmissionRepository implements ISubmissionRepository {
  async createSubmission(submission: ContractorMilestoneSubmission): Promise<ContractorMilestoneSubmission> {
    await dbManager.query(
      `INSERT INTO submissions (id, project_id, milestone_id, submitted_by_user_id, submitted_by_name, submission_number, status, narrative, evidence_ids, created_at, updated_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         narrative = EXCLUDED.narrative,
         evidence_ids = EXCLUDED.evidence_ids,
         updated_at = EXCLUDED.updated_at`,
      [
        submission.id,
        submission.projectId,
        submission.milestoneId,
        submission.submittedByUserId,
        submission.submittedByName,
        submission.revisionNumber || 1,
        submission.status || 'SUBMITTED',
        submission.summary || submission.contractorNotes || null,
        JSON.stringify(submission.evidenceIds || []),
        submission.createdAt ? new Date(submission.createdAt) : new Date(),
        submission.updatedAt ? new Date(submission.updatedAt) : new Date(),
        submission.isDemo ?? false,
      ]
    );
    return submission;
  }

  async getSubmissionById(id: string): Promise<ContractorMilestoneSubmission | null> {
    const res = await dbManager.query('SELECT * FROM submissions WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapSubmission(res.rows[0]);
  }

  async getSubmissionByMilestone(projectId: string, milestoneId: string): Promise<ContractorMilestoneSubmission | null> {
    const res = await dbManager.query(
      'SELECT * FROM submissions WHERE project_id = $1 AND milestone_id = $2 ORDER BY submission_number DESC LIMIT 1',
      [projectId, milestoneId]
    );
    if (res.rows.length === 0) return null;
    return this.mapSubmission(res.rows[0]);
  }

  async listSubmissionsByProject(projectId: string): Promise<ContractorMilestoneSubmission[]> {
    const res = await dbManager.query('SELECT * FROM submissions WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapSubmission(r));
  }

  async updateSubmission(id: string, updates: Partial<ContractorMilestoneSubmission>): Promise<ContractorMilestoneSubmission> {
    const current = await this.getSubmissionById(id);
    if (!current) throw new Error(`Submission ${id} not found`);
    const updated: ContractorMilestoneSubmission = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createSubmission(updated);
    return updated;
  }

  private mapSubmission(row: any): ContractorMilestoneSubmission {
    const evIds = typeof row.evidence_ids === 'string' ? JSON.parse(row.evidence_ids) : (row.evidence_ids || []);
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      submittedByUserId: row.submitted_by_user_id,
      submittedByRole: row.submitted_by_role || 'GENERAL_CONTRACTOR',
      submittedByName: row.submitted_by_name,
      status: row.status,
      title: row.title || 'Milestone Submission',
      summary: row.narrative || row.summary || '',
      contractorNotes: row.contractor_notes || row.narrative || '',
      evidenceIds: evIds,
      revisionNumber: Number(row.submission_number || row.revision_number) || 1,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 7. Postgres Technical Review Repository
// ==========================================================
export class PostgresTechnicalReviewRepository implements ITechnicalReviewRepository {
  async createReview(review: ProjectDirectorTechnicalReview): Promise<ProjectDirectorTechnicalReview> {
    await dbManager.query(
      `INSERT INTO technical_reviews (id, submission_id, project_id, reviewer_user_id, reviewer_name, reviewer_role, decision, comments, created_at, updated_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         decision = EXCLUDED.decision,
         comments = EXCLUDED.comments,
         updated_at = EXCLUDED.updated_at`,
      [
        review.id,
        review.submissionId,
        review.projectId,
        review.reviewedByUserId,
        review.reviewedByName,
        review.reviewedByRole,
        review.decision,
        review.reviewNotes || null,
        review.createdAt ? new Date(review.createdAt) : new Date(),
        review.completedAt ? new Date(review.completedAt) : new Date(),
        review.isDemo ?? false,
      ]
    );
    return review;
  }

  async getReviewById(id: string): Promise<ProjectDirectorTechnicalReview | null> {
    const res = await dbManager.query('SELECT * FROM technical_reviews WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapReview(res.rows[0]);
  }

  async listReviewsByProject(projectId: string): Promise<ProjectDirectorTechnicalReview[]> {
    const res = await dbManager.query('SELECT * FROM technical_reviews WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapReview(r));
  }

  async listReviewsBySubmission(submissionId: string): Promise<ProjectDirectorTechnicalReview[]> {
    const res = await dbManager.query('SELECT * FROM technical_reviews WHERE submission_id = $1 ORDER BY created_at DESC', [submissionId]);
    return res.rows.map(r => this.mapReview(r));
  }

  async updateReview(id: string, updates: Partial<ProjectDirectorTechnicalReview>): Promise<ProjectDirectorTechnicalReview> {
    const current = await this.getReviewById(id);
    if (!current) throw new Error(`Review ${id} not found`);
    const updated: ProjectDirectorTechnicalReview = {
      ...current,
      ...updates,
    };
    await this.createReview(updated);
    return updated;
  }

  private mapReview(row: any): ProjectDirectorTechnicalReview {
    return {
      id: row.id,
      submissionId: row.submission_id,
      projectId: row.project_id,
      milestoneId: row.milestone_id || '',
      reviewedByUserId: row.reviewer_user_id || row.reviewed_by_user_id,
      reviewedByName: row.reviewer_name || row.reviewed_by_name,
      reviewedByRole: row.reviewer_role || row.reviewed_by_role || 'SENIOR_PROJECT_DIRECTOR',
      decision: row.decision,
      reviewNotes: row.comments || row.review_notes || '',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      completedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.completed_at ? String(row.completed_at) : undefined),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 8. Postgres QA/QC Inspection Repository
// ==========================================================
export class PostgresQaqcInspectionRepository implements IQAQCInspectionRepository {
  async createInspection(inspection: QAQCInspection): Promise<QAQCInspection> {
    await dbManager.query(
      `INSERT INTO qaqc_inspections (id, project_id, milestone_id, inspector_user_id, inspector_role, inspector_name, inspection_status, inspection_type, inspection_notes, evidence_ids, created_at, updated_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         inspection_status = EXCLUDED.inspection_status,
         inspection_type = EXCLUDED.inspection_type,
         inspection_notes = EXCLUDED.inspection_notes,
         evidence_ids = EXCLUDED.evidence_ids,
         updated_at = EXCLUDED.updated_at`,
      [
        inspection.id,
        inspection.projectId,
        inspection.milestoneId,
        inspection.inspectorUserId,
        inspection.inspectorRole,
        inspection.inspectorName,
        inspection.inspectionStatus,
        inspection.inspectionType || 'GENERAL',
        inspection.inspectionNotes || null,
        JSON.stringify(inspection.evidenceIds || []),
        inspection.createdAt ? new Date(inspection.createdAt) : new Date(),
        inspection.updatedAt ? new Date(inspection.updatedAt) : new Date(),
        inspection.isDemo ?? false,
      ]
    );
    return inspection;
  }

  async getInspectionById(id: string): Promise<QAQCInspection | null> {
    const res = await dbManager.query('SELECT * FROM qaqc_inspections WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapInspection(res.rows[0]);
  }

  async listInspectionsByProject(projectId: string): Promise<QAQCInspection[]> {
    const res = await dbManager.query('SELECT * FROM qaqc_inspections WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapInspection(r));
  }

  async listInspectionsByMilestone(milestoneId: string): Promise<QAQCInspection[]> {
    const res = await dbManager.query('SELECT * FROM qaqc_inspections WHERE milestone_id = $1 ORDER BY created_at DESC', [milestoneId]);
    return res.rows.map(r => this.mapInspection(r));
  }

  async updateInspection(id: string, updates: Partial<QAQCInspection>): Promise<QAQCInspection> {
    const current = await this.getInspectionById(id);
    if (!current) throw new Error(`Inspection ${id} not found`);
    const updated: QAQCInspection = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createInspection(updated);
    return updated;
  }

  private mapInspection(row: any): QAQCInspection {
    const evIds = typeof row.evidence_ids === 'string' ? JSON.parse(row.evidence_ids) : (row.evidence_ids || []);
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      inspectorUserId: row.inspector_user_id,
      inspectorRole: row.inspector_role,
      inspectorName: row.inspector_name,
      inspectionStatus: row.inspection_status,
      inspectionType: row.inspection_type,
      inspectionNotes: row.inspection_notes || undefined,
      evidenceIds: evIds,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 9. Postgres NCR Repository
// ==========================================================
export class PostgresNcrRepository implements INCRRepository {
  async createNCR(ncr: NonConformanceReport): Promise<NonConformanceReport> {
    await dbManager.query(
      `INSERT INTO ncrs (id, project_id, milestone_id, inspection_id, number, title, description, severity, status, created_by_user_id, created_by_name, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         severity = EXCLUDED.severity,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        ncr.id,
        ncr.projectId,
        ncr.milestoneId || null,
        ncr.inspectionId || null,
        ncr.number,
        ncr.title,
        ncr.description || null,
        ncr.severity,
        ncr.status,
        ncr.raisedByUserId,
        ncr.raisedByName,
        ncr.createdAt ? new Date(ncr.createdAt) : new Date(),
        ncr.createdAt ? new Date(ncr.createdAt) : new Date(),
        ncr.isDemo ?? false,
        JSON.stringify({}),
      ]
    );
    return ncr;
  }

  async getNCRById(id: string): Promise<NonConformanceReport | null> {
    const res = await dbManager.query('SELECT * FROM ncrs WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapNCR(res.rows[0]);
  }

  async listNCRsByProject(projectId: string): Promise<NonConformanceReport[]> {
    const res = await dbManager.query('SELECT * FROM ncrs WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapNCR(r));
  }

  async listNCRsByMilestone(milestoneId: string): Promise<NonConformanceReport[]> {
    const res = await dbManager.query('SELECT * FROM ncrs WHERE milestone_id = $1 ORDER BY created_at DESC', [milestoneId]);
    return res.rows.map(r => this.mapNCR(r));
  }

  async updateNCR(id: string, updates: Partial<NonConformanceReport>): Promise<NonConformanceReport> {
    const current = await this.getNCRById(id);
    if (!current) throw new Error(`NCR ${id} not found`);
    const updated: NonConformanceReport = {
      ...current,
      ...updates,
    };
    await this.createNCR(updated);
    return updated;
  }

  private mapNCR(row: any): NonConformanceReport {
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id || '',
      inspectionId: row.inspection_id || undefined,
      number: row.number,
      title: row.title,
      description: row.description || '',
      severity: row.severity,
      status: row.status,
      raisedByUserId: row.created_by_user_id || row.raised_by_user_id || 'usr_demo_qaqc',
      raisedByName: row.created_by_name || row.raised_by_name || 'QA/QC Lead',
      raisedByRole: row.raised_by_role || 'STRUCTURAL_QA_QC_AUDITOR',
      assignedToUserId: row.assigned_to_user_id || 'usr_demo_contractor',
      assignedToName: row.assigned_to_name || 'General Contractor',
      assignedToRole: row.assigned_to_role || 'GENERAL_CONTRACTOR',
      requirementReference: row.requirement_reference || 'ACI 318-19 / ASTM C39',
      observedCondition: row.observed_condition || row.description || '',
      correctiveActionRequired: row.corrective_action_required || 'Review and remediate condition.',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 10. Postgres Owner Decision Repository
// ==========================================================
export class PostgresOwnerDecisionRepository implements IOwnerDecisionRepository {
  async createDecision(decision: OwnerMilestoneDecision): Promise<OwnerMilestoneDecision> {
    await dbManager.query(
      `INSERT INTO owner_decisions (id, project_id, milestone_id, owner_user_id, owner_name, decision, notes, payable_amount_usd, created_at, updated_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         decision = EXCLUDED.decision,
         notes = EXCLUDED.notes,
         payable_amount_usd = EXCLUDED.payable_amount_usd,
         updated_at = EXCLUDED.updated_at`,
      [
        decision.id,
        decision.projectId,
        decision.milestoneId,
        decision.decidedByUserId,
        decision.decidedByName,
        decision.decision,
        decision.decisionNotes || null,
        0,
        decision.createdAt ? new Date(decision.createdAt) : new Date(),
        decision.decidedAt ? new Date(decision.decidedAt) : new Date(),
        decision.isDemo ?? false,
      ]
    );
    return decision;
  }

  async getDecisionById(id: string): Promise<OwnerMilestoneDecision | null> {
    const res = await dbManager.query('SELECT * FROM owner_decisions WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapDecision(res.rows[0]);
  }

  async listDecisionsByMilestone(milestoneId: string): Promise<OwnerMilestoneDecision[]> {
    const res = await dbManager.query('SELECT * FROM owner_decisions WHERE milestone_id = $1 ORDER BY created_at DESC', [milestoneId]);
    return res.rows.map(r => this.mapDecision(r));
  }

  async listDecisionsByProject(projectId: string): Promise<OwnerMilestoneDecision[]> {
    const res = await dbManager.query('SELECT * FROM owner_decisions WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapDecision(r));
  }

  private mapDecision(row: any): OwnerMilestoneDecision {
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      decidedByUserId: row.owner_user_id || row.decided_by_user_id || 'usr_demo_owner',
      decidedByName: row.owner_name || row.decided_by_name || 'Owner Representative',
      decidedByRole: row.decided_by_role || 'OWNER_CLIENT',
      decision: row.decision,
      decisionNotes: row.notes || row.decision_notes || '',
      financialAuthorized: Boolean(row.financial_authorized),
      financialStatus: row.financial_status || 'NOT_AUTHORIZED',
      financialProviderStatus: row.financial_provider_status || 'NOT_CONFIGURED',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      decidedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.decided_at ? String(row.decided_at) : String(row.created_at)),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 11. Postgres Project Decision Repository
// ==========================================================
export class PostgresProjectDecisionRepository implements IProjectDecisionRepository {
  async createDecision(decision: ProjectDecision): Promise<ProjectDecision> {
    await dbManager.query(
      `INSERT INTO project_decisions (id, project_id, number, title, subject, description, category, status, options, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         subject = EXCLUDED.subject,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         status = EXCLUDED.status,
         options = EXCLUDED.options,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        decision.id,
        decision.projectId,
        decision.number,
        decision.title,
        decision.subject || null,
        decision.description || null,
        decision.category,
        decision.status,
        JSON.stringify(decision.options || []),
        decision.createdAt ? new Date(decision.createdAt) : new Date(),
        decision.updatedAt ? new Date(decision.updatedAt) : new Date(),
        decision.isDemo ?? false,
        JSON.stringify(decision),
      ]
    );
    return decision;
  }

  async getDecisionById(id: string): Promise<ProjectDecision | null> {
    const res = await dbManager.query('SELECT * FROM project_decisions WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapDecision(res.rows[0]);
  }

  async listDecisionsByProject(projectId: string): Promise<ProjectDecision[]> {
    const res = await dbManager.query('SELECT * FROM project_decisions WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapDecision(r));
  }

  async getDecisionsByProjectId(projectId: string): Promise<ProjectDecision[]> {
    return this.listDecisionsByProject(projectId);
  }

  async updateDecision(id: string, updates: Partial<ProjectDecision>): Promise<ProjectDecision | null> {
    const current = await this.getDecisionById(id);
    if (!current) return null;
    const updated: ProjectDecision = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createDecision(updated);
    return updated;
  }

  private mapDecision(row: any): ProjectDecision {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const opts = typeof row.options === 'string' ? JSON.parse(row.options) : (row.options || []);
    return {
      ...meta,
      id: row.id,
      projectId: row.project_id,
      number: row.number,
      title: row.title,
      subject: row.subject || '',
      description: row.description || '',
      category: row.category,
      status: row.status,
      options: opts,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 12. Postgres RFI Repository
// ==========================================================
export class PostgresRfiRepository implements IRFIRepository {
  async createRFI(data: any): Promise<RFI> {
    const id = data.id || `rfi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const rfi: RFI = {
      id,
      projectId: data.projectId,
      number: data.number || await this.getNextRFINumber(data.projectId),
      title: data.title,
      question: data.question,
      discipline: data.discipline,
      raisedByUserId: data.raisedByUserId,
      raisedByRole: data.raisedByRole,
      raisedByName: data.raisedByName,
      assignedToUserId: data.assignedToUserId,
      assignedToRole: data.assignedToRole,
      assignedToName: data.assignedToName,
      priority: data.priority,
      status: 'OPEN',
      relatedMilestoneId: data.relatedMilestoneId,
      relatedEvidenceIds: data.relatedEvidenceIds || [],
      dueAt: data.dueAt,
      createdAt: now,
      updatedAt: now,
    };

    await dbManager.query(
      `INSERT INTO rfis (id, project_id, number, title, question, discipline, raised_by_user_id, raised_by_role, raised_by_name, assigned_to_user_id, assigned_to_role, assigned_to_name, priority, status, related_milestone_id, related_evidence_ids, due_at, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         assigned_to_user_id = EXCLUDED.assigned_to_user_id,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        rfi.id,
        rfi.projectId,
        rfi.number,
        rfi.title,
        rfi.question,
        rfi.discipline,
        rfi.raisedByUserId,
        rfi.raisedByRole,
        rfi.raisedByName,
        rfi.assignedToUserId,
        rfi.assignedToRole,
        rfi.assignedToName,
        rfi.priority,
        rfi.status,
        rfi.relatedMilestoneId || null,
        JSON.stringify(rfi.relatedEvidenceIds || []),
        rfi.dueAt ? new Date(rfi.dueAt) : null,
        new Date(rfi.createdAt),
        new Date(rfi.updatedAt),
        rfi.isDemo ?? false,
        JSON.stringify(rfi),
      ]
    );
    return rfi;
  }

  async getRFIById(id: string): Promise<RFI | null> {
    const res = await dbManager.query('SELECT * FROM rfis WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapRFI(res.rows[0]);
  }

  async listRFIsByProject(projectId: string): Promise<RFI[]> {
    const res = await dbManager.query('SELECT * FROM rfis WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapRFI(r));
  }

  async updateRFI(id: string, updates: Partial<RFI>): Promise<RFI> {
    const current = await this.getRFIById(id);
    if (!current) throw new Error(`RFI ${id} not found`);
    const updated: RFI = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await dbManager.query(
      `UPDATE rfis SET status = $1, assigned_to_user_id = $2, updated_at = $3, metadata = $4 WHERE id = $5`,
      [updated.status, updated.assignedToUserId, new Date(updated.updatedAt), JSON.stringify(updated), id]
    );
    return updated;
  }

  async getNextRFINumber(projectId: string): Promise<string> {
    const list = await this.listRFIsByProject(projectId);
    const count = list.length + 1;
    return `RFI-${String(count).padStart(3, '0')}`;
  }

  private mapRFI(row: any): RFI {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return {
      ...meta,
      id: row.id,
      projectId: row.project_id,
      number: row.number,
      title: row.title,
      question: row.question,
      discipline: row.discipline,
      raisedByUserId: row.raised_by_user_id,
      raisedByRole: row.raised_by_role,
      raisedByName: row.raised_by_name,
      assignedToUserId: row.assigned_to_user_id,
      assignedToRole: row.assigned_to_role,
      assignedToName: row.assigned_to_name,
      priority: row.priority,
      status: row.status,
      relatedMilestoneId: row.related_milestone_id || undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }
}

// ==========================================================
// 13. Postgres Direct Line Repository
// ==========================================================
function getChannelParticipantRoles(channelType: ChannelType): [ProjectRole, ProjectRole] {
  switch (channelType) {
    case 'OWNER_DIRECTOR':
      return ['OWNER_CLIENT', 'SENIOR_PROJECT_DIRECTOR'];
    case 'OWNER_QAQC':
      return ['OWNER_CLIENT', 'STRUCTURAL_QA_QC_AUDITOR'];
    case 'DIRECTOR_CONTRACTOR':
      return ['SENIOR_PROJECT_DIRECTOR', 'GENERAL_CONTRACTOR'];
  }
}

export class PostgresDirectLineRepository implements IDirectLineRepository {
  async getOrCreateConversation(projectId: string, channelType: ChannelType): Promise<ProjectConversation> {
    const convs = await this.getConversationsByProject(projectId);
    const existing = convs.find(c => c.channelType === channelType);
    if (existing) return existing;

    const id = `conv-${projectId}-${channelType}`;
    const now = new Date().toISOString();
    const conv: ProjectConversation = {
      id,
      projectId,
      channelType,
      participantRoles: getChannelParticipantRoles(channelType),
      createdAt: now,
      updatedAt: now,
    };

    await dbManager.query(
      `INSERT INTO project_conversations (id, project_id, channel_type, title, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [conv.id, conv.projectId, conv.channelType, `${channelType.replace(/_/g, ' ')} Channel`, new Date(conv.createdAt), new Date(conv.updatedAt)]
    );
    return conv;
  }

  async getConversationsByProject(projectId: string): Promise<ProjectConversation[]> {
    const res = await dbManager.query('SELECT * FROM project_conversations WHERE project_id = $1 ORDER BY updated_at DESC', [projectId]);
    return res.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      channelType: r.channel_type,
      participantRoles: getChannelParticipantRoles(r.channel_type),
      lastMessageSnippet: r.last_message_snippet || undefined,
      lastMessageAt: r.last_message_at instanceof Date ? r.last_message_at.toISOString() : (r.last_message_at || undefined),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  }

  async getConversationById(id: string): Promise<ProjectConversation | null> {
    const res = await dbManager.query('SELECT * FROM project_conversations WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      channelType: r.channel_type,
      participantRoles: getChannelParticipantRoles(r.channel_type),
      lastMessageSnippet: r.last_message_snippet || undefined,
      lastMessageAt: r.last_message_at instanceof Date ? r.last_message_at.toISOString() : (r.last_message_at || undefined),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    };
  }

  async addMessage(data: {
    projectId: string;
    channelType: ChannelType;
    senderUserId: string;
    senderRole: ProjectRole;
    senderName: string;
    messageType: DirectLineMessageType;
    subject?: string;
    content: string;
    relatedEntityId?: string;
  }): Promise<ProjectMessage> {
    const conv = await this.getOrCreateConversation(data.projectId, data.channelType);
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const msg: ProjectMessage = {
      id,
      conversationId: conv.id,
      projectId: data.projectId,
      channelType: data.channelType,
      senderUserId: data.senderUserId,
      senderRole: data.senderRole,
      senderName: data.senderName,
      messageType: data.messageType,
      subject: data.subject,
      content: data.content,
      relatedEntityId: data.relatedEntityId,
      createdAt: now,
    };

    await dbManager.query(
      `INSERT INTO project_messages (id, conversation_id, project_id, channel_type, sender_user_id, sender_role, sender_name, message_type, subject, content, related_entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        msg.id,
        msg.conversationId,
        msg.projectId,
        msg.channelType,
        msg.senderUserId,
        msg.senderRole,
        msg.senderName,
        msg.messageType,
        msg.subject || null,
        msg.content,
        msg.relatedEntityId || null,
        new Date(msg.createdAt),
      ]
    );

    await dbManager.query(
      `UPDATE project_conversations SET updated_at = $1, last_message_snippet = $2, last_message_at = $3 WHERE id = $4`,
      [new Date(now), msg.content.substring(0, 100), new Date(now), conv.id]
    );

    return msg;
  }

  async getMessagesByChannel(projectId: string, channelType: ChannelType): Promise<ProjectMessage[]> {
    const res = await dbManager.query(
      'SELECT * FROM project_messages WHERE project_id = $1 AND channel_type = $2 ORDER BY created_at ASC',
      [projectId, channelType]
    );
    return res.rows.map(r => ({
      id: r.id,
      conversationId: r.conversation_id,
      projectId: r.project_id,
      channelType: r.channel_type,
      senderUserId: r.sender_user_id,
      senderRole: r.sender_role,
      senderName: r.sender_name,
      messageType: r.message_type,
      subject: r.subject || undefined,
      content: r.content,
      relatedEntityId: r.related_entity_id || undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }
}

// ==========================================================
// 14. Postgres Notification Repository
// ==========================================================
export class PostgresNotificationRepository implements INotificationRepository {
  async createNotification(notif: ProjectNotification): Promise<ProjectNotification> {
    await dbManager.query(
      `INSERT INTO notifications (id, project_id, recipient_user_id, recipient_role, type, title, message, severity, related_record_type, related_record_id, is_read, read_at, created_at, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         is_read = EXCLUDED.is_read,
         read_at = EXCLUDED.read_at`,
      [
        notif.id,
        notif.projectId,
        notif.recipientUserId,
        notif.recipientRole,
        notif.type,
        notif.title,
        notif.message,
        notif.severity || 'INFO',
        notif.relatedRecordType || null,
        notif.relatedRecordId || null,
        notif.isRead ?? false,
        notif.readAt ? new Date(notif.readAt) : null,
        notif.createdAt ? new Date(notif.createdAt) : new Date(),
        notif.isDemo ?? false,
      ]
    );
    return notif;
  }

  async getNotificationById(id: string): Promise<ProjectNotification | null> {
    const res = await dbManager.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapNotif(res.rows[0]);
  }

  async listNotificationsByRecipient(projectId: string, recipientUserId: string): Promise<ProjectNotification[]> {
    const res = await dbManager.query(
      'SELECT * FROM notifications WHERE project_id = $1 AND recipient_user_id = $2 ORDER BY created_at DESC',
      [projectId, recipientUserId]
    );
    return res.rows.map(r => this.mapNotif(r));
  }

  async listNotificationsByProject(projectId: string): Promise<ProjectNotification[]> {
    const res = await dbManager.query('SELECT * FROM notifications WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapNotif(r));
  }

  async getNotificationsForUser(projectId: string, recipientUserId: string): Promise<ProjectNotification[]> {
    return this.listNotificationsByRecipient(projectId, recipientUserId);
  }

  async getNotificationsByProjectId(projectId: string): Promise<ProjectNotification[]> {
    return this.listNotificationsByProject(projectId);
  }

  async markAsRead(id: string): Promise<ProjectNotification | null> {
    const now = new Date().toISOString();
    await dbManager.query('UPDATE notifications SET is_read = TRUE, read_at = $1 WHERE id = $2', [new Date(now), id]);
    return this.getNotificationById(id);
  }

  async markAllAsRead(projectId: string, recipientUserId: string): Promise<number> {
    const now = new Date().toISOString();
    const res = await dbManager.query(
      'UPDATE notifications SET is_read = TRUE, read_at = $1 WHERE project_id = $2 AND recipient_user_id = $3 AND is_read = FALSE',
      [new Date(now), projectId, recipientUserId]
    );
    return res.rowCount || 0;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const res = await dbManager.query('DELETE FROM notifications WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  }

  private mapNotif(row: any): ProjectNotification {
    return {
      id: row.id,
      projectId: row.project_id,
      recipientUserId: row.recipient_user_id,
      recipientRole: row.recipient_role,
      type: row.type,
      title: row.title,
      message: row.message,
      severity: row.severity,
      relatedRecordType: row.related_record_type || undefined,
      relatedRecordId: row.related_record_id || undefined,
      isRead: Boolean(row.is_read),
      readAt: row.read_at instanceof Date ? row.read_at.toISOString() : (row.read_at || undefined),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 15. Postgres Closeout Repository
// ==========================================================
export class PostgresCloseoutRepository implements ICloseoutRepository {
  async getCloseoutByProject(projectId: string): Promise<ProjectCloseout | null> {
    const res = await dbManager.query('SELECT * FROM closeouts WHERE project_id = $1', [projectId]);
    if (res.rows.length === 0) return null;
    return this.mapCloseout(res.rows[0]);
  }

  async saveCloseout(closeout: ProjectCloseout): Promise<ProjectCloseout> {
    await dbManager.query(
      `INSERT INTO closeouts (id, project_id, overall_status, target_completion_date, completed_at, checklist, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         overall_status = EXCLUDED.overall_status,
         target_completion_date = EXCLUDED.target_completion_date,
         completed_at = EXCLUDED.completed_at,
         checklist = EXCLUDED.checklist,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        closeout.id,
        closeout.projectId,
        closeout.status,
        null,
        closeout.completedAt ? new Date(closeout.completedAt) : null,
        JSON.stringify(closeout.checklist || []),
        closeout.createdAt ? new Date(closeout.createdAt) : new Date(),
        closeout.updatedAt ? new Date(closeout.updatedAt) : new Date(),
        closeout.isDemo ?? false,
        JSON.stringify({}),
      ]
    );
    return closeout;
  }

  async updateCloseout(projectId: string, updates: Partial<ProjectCloseout>): Promise<ProjectCloseout | null> {
    const current = await this.getCloseoutByProject(projectId);
    if (!current) return null;
    const updated: ProjectCloseout = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveCloseout(updated);
    return updated;
  }

  async updateChecklistItem(projectId: string, itemId: string, updates: Partial<CloseoutChecklistItem>): Promise<ProjectCloseout | null> {
    const current = await this.getCloseoutByProject(projectId);
    if (!current) return null;
    const checklist = current.checklist.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          ...updates,
          completedAt: updates.isCompleted ? (updates.completedAt || new Date().toISOString()) : undefined,
        };
      }
      return item;
    });
    return this.updateCloseout(projectId, { checklist });
  }

  private mapCloseout(row: any): ProjectCloseout {
    const chk = typeof row.checklist === 'string' ? JSON.parse(row.checklist) : (row.checklist || []);
    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status || row.overall_status || 'NOT_STARTED',
      completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : (row.completed_at || undefined),
      checklist: chk,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 16. Postgres Punch Item Repository
// ==========================================================
export class PostgresPunchItemRepository implements IPunchItemRepository {
  async createPunchItem(item: PunchItem): Promise<PunchItem> {
    await dbManager.query(
      `INSERT INTO punch_items (id, project_id, milestone_id, number, title, description, category, priority, status, raised_by_user_id, raised_by_role, raised_by_name, raised_at, assigned_to_user_id, assigned_to_role, assigned_to_name, assigned_at, verified_by_user_id, verified_by_role, verified_by_name, verified_at, evidence_ids, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         assigned_to_user_id = EXCLUDED.assigned_to_user_id,
         assigned_to_name = EXCLUDED.assigned_to_name,
         verified_by_user_id = EXCLUDED.verified_by_user_id,
         verified_at = EXCLUDED.verified_at,
         evidence_ids = EXCLUDED.evidence_ids,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        item.id,
        item.projectId,
        item.milestoneId || null,
        item.number,
        item.title,
        item.description || null,
        item.category,
        item.priority,
        item.status,
        item.raisedByUserId,
        item.raisedByRole,
        item.raisedByName,
        item.raisedAt ? new Date(item.raisedAt) : new Date(),
        item.assignedToUserId || null,
        item.assignedToRole || null,
        item.assignedToName || null,
        item.assignedAt ? new Date(item.assignedAt) : null,
        item.verifiedByUserId || null,
        item.verifiedByName || null,
        item.verifiedAt ? new Date(item.verifiedAt) : null,
        JSON.stringify(item.evidenceIds || []),
        item.createdAt ? new Date(item.createdAt) : new Date(),
        item.updatedAt ? new Date(item.updatedAt) : new Date(),
        item.isDemo ?? false,
        JSON.stringify({}),
      ]
    );
    return item;
  }

  async getPunchItemById(id: string): Promise<PunchItem | null> {
    const res = await dbManager.query('SELECT * FROM punch_items WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapPunch(res.rows[0]);
  }

  async listPunchItemsByProject(projectId: string): Promise<PunchItem[]> {
    const res = await dbManager.query('SELECT * FROM punch_items WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapPunch(r));
  }

  async listPunchItemsByMilestone(projectId: string, milestoneId: string): Promise<PunchItem[]> {
    const res = await dbManager.query(
      'SELECT * FROM punch_items WHERE project_id = $1 AND milestone_id = $2 ORDER BY created_at DESC',
      [projectId, milestoneId]
    );
    return res.rows.map(r => this.mapPunch(r));
  }

  async updatePunchItem(id: string, updates: Partial<PunchItem>): Promise<PunchItem | null> {
    const current = await this.getPunchItemById(id);
    if (!current) return null;
    const updated: PunchItem = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createPunchItem(updated);
    return updated;
  }

  async getNextPunchNumber(projectId: string): Promise<string> {
    const list = await this.listPunchItemsByProject(projectId);
    const count = list.length + 1;
    return `PUNCH-${String(count).padStart(3, '0')}`;
  }

  private mapPunch(row: any): PunchItem {
    const evIds = typeof row.evidence_ids === 'string' ? JSON.parse(row.evidence_ids) : (row.evidence_ids || []);
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id || undefined,
      number: row.number,
      title: row.title,
      description: row.description || '',
      category: row.category,
      priority: row.priority,
      status: row.status,
      raisedByUserId: row.raised_by_user_id,
      raisedByRole: row.raised_by_role,
      raisedByName: row.raised_by_name,
      raisedAt: row.raised_at instanceof Date ? row.raised_at.toISOString() : String(row.raised_at),
      assignedToUserId: row.assigned_to_user_id || undefined,
      assignedToRole: row.assigned_to_role || undefined,
      assignedToName: row.assigned_to_name || undefined,
      assignedAt: row.assigned_at instanceof Date ? row.assigned_at.toISOString() : (row.assigned_at || undefined),
      verifiedByUserId: row.verified_by_user_id || undefined,
      verifiedByName: row.verified_by_name || undefined,
      verifiedAt: row.verified_at instanceof Date ? row.verified_at.toISOString() : (row.verified_at || undefined),
      evidenceIds: evIds,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 17. Postgres Handover Repository
// ==========================================================
export class PostgresHandoverRepository implements IHandoverRepository {
  async getHandoverByProject(projectId: string): Promise<ProjectHandover | null> {
    const res = await dbManager.query('SELECT * FROM handovers WHERE project_id = $1', [projectId]);
    if (res.rows.length === 0) return null;
    return this.mapHandover(res.rows[0]);
  }

  async saveHandover(handover: ProjectHandover): Promise<ProjectHandover> {
    await dbManager.query(
      `INSERT INTO handovers (id, project_id, status, target_handover_date, executed_at, checklist, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         target_handover_date = EXCLUDED.target_handover_date,
         executed_at = EXCLUDED.executed_at,
         checklist = EXCLUDED.checklist,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        handover.id,
        handover.projectId,
        handover.status,
        handover.targetHandoverDate ? new Date(handover.targetHandoverDate) : null,
        handover.actualHandoverDate ? new Date(handover.actualHandoverDate) : null,
        JSON.stringify(handover.checklist || []),
        handover.createdAt ? new Date(handover.createdAt) : new Date(),
        handover.updatedAt ? new Date(handover.updatedAt) : new Date(),
        handover.isDemo ?? false,
        JSON.stringify({}),
      ]
    );
    return handover;
  }

  async updateHandover(projectId: string, updates: Partial<ProjectHandover>): Promise<ProjectHandover | null> {
    const current = await this.getHandoverByProject(projectId);
    if (!current) return null;
    const updated: ProjectHandover = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveHandover(updated);
    return updated;
  }

  async updateChecklistItem(projectId: string, itemId: string, updates: Partial<HandoverChecklistItem>): Promise<ProjectHandover | null> {
    const current = await this.getHandoverByProject(projectId);
    if (!current) return null;
    const checklist = current.checklist.map(item => {
      if (item.id === itemId) {
        return { ...item, ...updates };
      }
      return item;
    });
    return this.updateHandover(projectId, { checklist });
  }

  private mapHandover(row: any): ProjectHandover {
    const chk = typeof row.checklist === 'string' ? JSON.parse(row.checklist) : (row.checklist || []);
    return {
      id: row.id,
      projectId: row.project_id,
      status: row.status,
      targetHandoverDate: row.target_handover_date instanceof Date ? row.target_handover_date.toISOString() : (row.target_handover_date || undefined),
      actualHandoverDate: row.executed_at instanceof Date ? row.executed_at.toISOString() : (row.executed_at || undefined),
      includedRecordCounts: {
        milestones: 0,
        evidence: 0,
        technicalReviews: 0,
        qaqcInspections: 0,
        ncrs: 0,
        ownerDecisions: 0,
        projectDecisions: 0,
        rfis: 0,
        punchItems: 0,
        closeoutItems: 0,
      },
      checklist: chk,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
    };
  }
}

// ==========================================================
// 18. Postgres AI Inspection Repository
// ==========================================================
export class PostgresAiInspectionRepository implements IAIInspectionRepository {
  async createAnalysis(analysis: AIInspectionAnalysis): Promise<AIInspectionAnalysis> {
    const analysisResult = {
      summary: analysis.summary,
      observations: analysis.observations,
      potentialIssues: analysis.potentialIssues,
      riskIndicators: analysis.riskIndicators,
      recommendations: analysis.recommendations,
      rawResponseText: analysis.rawResponseText,
      errorMessage: analysis.errorMessage,
    };

    await dbManager.query(
      `INSERT INTO ai_inspections (id, project_id, milestone_id, status, analysis_result, human_review_required, model, created_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         analysis_result = EXCLUDED.analysis_result,
         human_review_required = EXCLUDED.human_review_required,
         model = EXCLUDED.model,
         metadata = EXCLUDED.metadata`,
      [
        analysis.id,
        analysis.projectId,
        analysis.milestoneId || null,
        analysis.analysisStatus || 'COMPLETED',
        JSON.stringify(analysisResult),
        analysis.humanReviewRequired ?? true,
        analysis.model || 'gemini-3.7-flash',
        analysis.createdAt ? new Date(analysis.createdAt) : new Date(),
        JSON.stringify(analysis),
      ]
    );
    return analysis;
  }

  async getAnalysisById(id: string): Promise<AIInspectionAnalysis | null> {
    const res = await dbManager.query('SELECT * FROM ai_inspections WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapAnalysis(res.rows[0]);
  }

  async listAnalysesByMilestone(milestoneId: string): Promise<AIInspectionAnalysis[]> {
    const res = await dbManager.query('SELECT * FROM ai_inspections WHERE milestone_id = $1 ORDER BY created_at DESC', [milestoneId]);
    return res.rows.map(r => this.mapAnalysis(r));
  }

  async listAnalysesByProject(projectId: string): Promise<AIInspectionAnalysis[]> {
    const res = await dbManager.query('SELECT * FROM ai_inspections WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapAnalysis(r));
  }

  async updateAnalysis(id: string, updates: Partial<AIInspectionAnalysis>): Promise<AIInspectionAnalysis> {
    const current = await this.getAnalysisById(id);
    if (!current) throw new Error(`AI Analysis ${id} not found`);
    const updated: AIInspectionAnalysis = {
      ...current,
      ...updates,
    };
    await this.createAnalysis(updated);
    return updated;
  }

  private mapAnalysis(row: any): AIInspectionAnalysis {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const result = typeof row.analysis_result === 'string' ? JSON.parse(row.analysis_result) : (row.analysis_result || {});
    return {
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      inspectionId: meta.inspectionId,
      evidenceIds: meta.evidenceIds || [],
      analysisStatus: (row.status as any) || 'COMPLETED',
      model: row.model || 'gemini-3.7-flash',
      summary: result.summary || meta.summary || '',
      observations: result.observations || meta.observations || [],
      potentialIssues: result.potentialIssues || meta.potentialIssues || [],
      riskIndicators: result.riskIndicators || meta.riskIndicators || [],
      recommendations: result.recommendations || meta.recommendations || [],
      humanReviewRequired: row.human_review_required ?? true,
      rawResponseText: result.rawResponseText || meta.rawResponseText,
      errorMessage: result.errorMessage || meta.errorMessage,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      isDemo: Boolean(row.is_demo ?? meta.isDemo),
    };
  }
}

// ==========================================================
// 19. Postgres Financial Instruction Repository
// ==========================================================
export class PostgresFinancialInstructionRepository implements IFinancialInstructionRepository {
  async createInstruction(fi: FinancialInstruction): Promise<FinancialInstruction> {
    await dbManager.query(
      `INSERT INTO financial_instructions (id, project_id, milestone_id, owner_decision_id, recipient_org_id, amount_usd, currency, idempotency_key, status, provider_reference, reason, created_by_user_id, authorized_at, created_at, updated_at, is_demo, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         provider_reference = EXCLUDED.provider_reference,
         updated_at = EXCLUDED.updated_at,
         metadata = EXCLUDED.metadata`,
      [
        fi.id,
        fi.projectId,
        fi.milestoneId,
        fi.ownerDecisionId || null,
        fi.contractorUserId || (fi as any).recipientOrgId || 'org-gc',
        fi.amountUSD || 0,
        fi.currency || 'USD',
        fi.idempotencyKey || `idem-${fi.id}`,
        fi.status || 'AUTHORIZED_FOR_FINANCIAL_PROCESSING',
        fi.providerReference || null,
        fi.executionNotes || fi.failureReason || null,
        fi.createdByUserId || 'usr_owner',
        new Date(),
        fi.createdAt ? new Date(fi.createdAt) : new Date(),
        fi.updatedAt ? new Date(fi.updatedAt) : new Date(),
        fi.isDemo ?? false,
        JSON.stringify(fi),
      ]
    );
    return fi;
  }

  async getInstructionById(id: string): Promise<FinancialInstruction | null> {
    const res = await dbManager.query('SELECT * FROM financial_instructions WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapFI(res.rows[0]);
  }

  async findById(id: string): Promise<FinancialInstruction | null> {
    return this.getInstructionById(id);
  }

  async getInstructionByIdempotencyKey(projectId: string, idempotencyKey: string): Promise<FinancialInstruction | null> {
    const res = await dbManager.query(
      'SELECT * FROM financial_instructions WHERE project_id = $1 AND idempotency_key = $2 LIMIT 1',
      [projectId, idempotencyKey]
    );
    if (res.rows.length === 0) return null;
    return this.mapFI(res.rows[0]);
  }

  async getInstructionByMilestoneId(milestoneId: string): Promise<FinancialInstruction | null> {
    const res = await dbManager.query(
      'SELECT * FROM financial_instructions WHERE milestone_id = $1 ORDER BY created_at DESC LIMIT 1',
      [milestoneId]
    );
    if (res.rows.length === 0) return null;
    return this.mapFI(res.rows[0]);
  }

  async listInstructionsByProject(projectId: string): Promise<FinancialInstruction[]> {
    const res = await dbManager.query('SELECT * FROM financial_instructions WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return res.rows.map(r => this.mapFI(r));
  }

  async listByProject(projectId: string): Promise<FinancialInstruction[]> {
    return this.listInstructionsByProject(projectId);
  }

  async getInstructionsByProjectId(projectId: string): Promise<FinancialInstruction[]> {
    return this.listInstructionsByProject(projectId);
  }

  async updateInstruction(id: string, updates: Partial<FinancialInstruction>): Promise<FinancialInstruction | null> {
    const current = await this.getInstructionById(id);
    if (!current) return null;
    const updated: FinancialInstruction = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.createInstruction(updated);
    return updated;
  }

  async update(id: string, updates: Partial<FinancialInstruction>): Promise<FinancialInstruction | null> {
    return this.updateInstruction(id, updates);
  }

  async getNextInstructionNumber(projectId: string): Promise<string> {
    const list = await this.listInstructionsByProject(projectId);
    const count = list.length + 1;
    return `FI-${String(count).padStart(3, '0')}`;
  }

  async countInstructions(projectId: string): Promise<number> {
    const list = await this.listInstructionsByProject(projectId);
    return list.length;
  }

  private mapFI(row: any): FinancialInstruction {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return {
      id: row.id,
      instructionNumber: meta.instructionNumber || `FI-${row.id.substring(0, 6)}`,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      ownerDecisionId: row.owner_decision_id || meta.ownerDecisionId || '',
      amountUSD: Number(row.amount_usd) || 0,
      currency: row.currency || 'USD',
      contractorUserId: meta.contractorUserId || row.recipient_org_id || 'usr_gc',
      contractorName: meta.contractorName,
      status: row.status || 'AUTHORIZED_FOR_FINANCIAL_PROCESSING',
      idempotencyKey: row.idempotency_key,
      providerId: meta.providerId || 'BMONI',
      providerStatus: meta.providerStatus || 'NOT_CONNECTED',
      providerReference: row.provider_reference || meta.providerReference,
      providerTransactionId: meta.providerTransactionId,
      providerRawResponse: meta.providerRawResponse,
      executionNotes: row.reason || meta.executionNotes,
      failureReason: meta.failureReason,
      settlementRecord: meta.settlementRecord,
      reconciliationRecord: meta.reconciliationRecord,
      createdByUserId: row.created_by_user_id || meta.createdByUserId || 'usr_owner',
      createdByRole: meta.createdByRole || 'OWNER_CLIENT',
      createdByName: meta.createdByName || 'Owner',
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      isDemo: Boolean(row.is_demo),
      ...meta,
    };
  }
}

// ==========================================================
// 20. Postgres Audit Event Repository
// ==========================================================
export class PostgresAuditEventRepository implements IAuditEventRepository {
  async record(event: AuditEvent): Promise<AuditEvent> {
    await dbManager.query(
      `INSERT INTO audit_events (id, timestamp, action, actor_user_id, organization_id, project_id, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        new Date(event.timestamp),
        event.action,
        event.actorUserId,
        event.organizationId || null,
        event.projectId || null,
        event.entityType,
        event.entityId,
        JSON.stringify(event.metadata || {}),
      ]
    );
    return event;
  }

  async listByProject(projectId: string): Promise<AuditEvent[]> {
    const res = await dbManager.query(
      'SELECT * FROM audit_events WHERE project_id = $1 ORDER BY timestamp DESC',
      [projectId]
    );
    return res.rows.map(r => this.mapAudit(r));
  }

  async listByOrganization(organizationId: string): Promise<AuditEvent[]> {
    const res = await dbManager.query(
      'SELECT * FROM audit_events WHERE organization_id = $1 ORDER BY timestamp DESC',
      [organizationId]
    );
    return res.rows.map(r => this.mapAudit(r));
  }

  async getByProjectId(projectId: string): Promise<AuditEvent[]> {
    return this.listByProject(projectId);
  }

  private mapAudit(row: any): AuditEvent {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return {
      id: row.id,
      timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
      action: row.action,
      actorUserId: row.actor_user_id || row.actor_id || 'usr_system',
      organizationId: row.organization_id || undefined,
      projectId: row.project_id || undefined,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: meta,
    };
  }
}
