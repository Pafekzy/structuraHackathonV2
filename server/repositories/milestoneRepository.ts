import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectMilestone } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresMilestoneRepository } from '../db/postgresRepositories';

export interface IMilestoneRepository {
  createMilestone(milestone: ProjectMilestone): Promise<ProjectMilestone>;
  getMilestoneById(id: string): Promise<ProjectMilestone | null>;
  listMilestonesByProject(projectId: string): Promise<ProjectMilestone[]>;
  getMilestonesByProjectId(projectId: string): Promise<ProjectMilestone[]>;
  updateMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<ProjectMilestone>;
}

export const INITIAL_DEMO_MILESTONES: ProjectMilestone[] = [
  {
    id: 'ms-hv-001',
    projectId: 'proj-horizon-villa',
    title: 'Foundation Works & Reinforced Raft Slab',
    description: 'Subgrade preparation, blind concrete, moisture barrier, dual rebar mat installation, anchor blockouts, and C35/45 monolithic pour with 28-day cylinder curing verification.',
    sequence: 1,
    discipline: 'Substructure & Earthworks',
    status: 'IN_PROGRESS',
    requiresProjectDirectorReview: true,
    requiresQaQcReview: true,
    requiresOwnerApproval: true,
    contractorSubmissionStatus: 'DRAFT',
    technicalReviewStatus: 'NONE',
    qaQcStatus: 'PENDING',
    ownerDecisionStatus: 'PENDING',
    financialStatus: 'AWAITING_GOVERNANCE',
    plannedStartDate: '2026-03-01',
    plannedEndDate: '2026-05-15',
    startedAt: '2026-03-05T08:00:00.000Z',
    costAllocationUSD: 485000,
    progressPercentage: 85,
    relatedEvidenceIds: ['ev-demo-001', 'ev-demo-002'],
    activeSubmissionId: 'sub-hv-draft-001',
    createdByUserId: 'usr_demo_director',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-08-20T14:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'ms-hv-002',
    projectId: 'proj-horizon-villa',
    title: 'Structural Frame & Post-Tensioned Suspended Decks',
    description: 'Reinforced concrete shear walls, perimeter columns, PT unbonded tendon layout, post-tensioning stressing elongation logs, and formwork stripping criteria.',
    sequence: 2,
    discipline: 'Structural Concrete & Frame',
    status: 'NOT_STARTED',
    requiresProjectDirectorReview: true,
    requiresQaQcReview: true,
    requiresOwnerApproval: true,
    contractorSubmissionStatus: 'NONE',
    technicalReviewStatus: 'NONE',
    qaQcStatus: 'PENDING',
    ownerDecisionStatus: 'PENDING',
    financialStatus: 'AWAITING_GOVERNANCE',
    plannedStartDate: '2026-05-16',
    plannedEndDate: '2026-08-30',
    costAllocationUSD: 820000,
    progressPercentage: 0,
    relatedEvidenceIds: [],
    createdByUserId: 'usr_demo_director',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'ms-hv-003',
    projectId: 'proj-horizon-villa',
    title: 'High-Performance Curtain Wall & Envelope Glazing',
    description: 'Unitized structural silicone glazing, thermally broken aluminum mullions, pressure-equalized rainscreen gaskets, and air/water infiltration chamber testing.',
    sequence: 3,
    discipline: 'Envelope & Curtain Wall',
    status: 'NOT_STARTED',
    requiresProjectDirectorReview: true,
    requiresQaQcReview: true,
    requiresOwnerApproval: true,
    contractorSubmissionStatus: 'NONE',
    technicalReviewStatus: 'NONE',
    qaQcStatus: 'PENDING',
    ownerDecisionStatus: 'PENDING',
    financialStatus: 'AWAITING_GOVERNANCE',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-11-30',
    costAllocationUSD: 640000,
    progressPercentage: 0,
    relatedEvidenceIds: [],
    createdByUserId: 'usr_demo_director',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'ms-hv-004',
    projectId: 'proj-horizon-villa',
    title: 'MEP Rough-In & Smart VRF HVAC Distribution',
    description: 'Concealed refrigerant lines, acoustic ductwork, sanitary drainage acoustic insulation, and electrical busway risers with pressure decay leak testing.',
    sequence: 4,
    discipline: 'MEP Rough-In',
    status: 'NOT_STARTED',
    requiresProjectDirectorReview: true,
    requiresQaQcReview: true,
    requiresOwnerApproval: true,
    contractorSubmissionStatus: 'NONE',
    technicalReviewStatus: 'NONE',
    qaQcStatus: 'PENDING',
    ownerDecisionStatus: 'PENDING',
    financialStatus: 'AWAITING_GOVERNANCE',
    plannedStartDate: '2026-11-01',
    plannedEndDate: '2027-01-20',
    costAllocationUSD: 510000,
    progressPercentage: 0,
    relatedEvidenceIds: [],
    createdByUserId: 'usr_demo_director',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'ms-hv-005',
    projectId: 'proj-horizon-villa',
    title: 'Interior Architectural Finishes & Millwork',
    description: 'Calacatta marble tiling, custom acoustical wood ceiling slats, frameless architectural doors, and low-VOC bespoke cabinetry installation.',
    sequence: 5,
    discipline: 'Interior Fitout & Finishes',
    status: 'NOT_STARTED',
    requiresProjectDirectorReview: true,
    requiresQaQcReview: false,
    requiresOwnerApproval: true,
    contractorSubmissionStatus: 'NONE',
    technicalReviewStatus: 'NONE',
    qaQcStatus: 'NOT_REQUIRED',
    ownerDecisionStatus: 'PENDING',
    financialStatus: 'AWAITING_GOVERNANCE',
    plannedStartDate: '2027-01-21',
    plannedEndDate: '2027-04-10',
    costAllocationUSD: 425000,
    progressPercentage: 0,
    relatedEvidenceIds: [],
    createdByUserId: 'usr_demo_director',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'ms-hv-006',
    projectId: 'proj-horizon-villa',
    title: 'Integrated Commissioning, Life Safety & Handover',
    description: 'End-to-end building management system (BMS) integration, smoke control testing, municipal occupancy compliance audit, and final O&M manual digital handover.',
    sequence: 6,
    discipline: 'Commissioning & Handover',
    status: 'NOT_STARTED',
    requiresProjectDirectorReview: true,
    requiresQaQcReview: true,
    requiresOwnerApproval: true,
    contractorSubmissionStatus: 'NONE',
    technicalReviewStatus: 'NONE',
    qaQcStatus: 'PENDING',
    ownerDecisionStatus: 'PENDING',
    financialStatus: 'AWAITING_GOVERNANCE',
    plannedStartDate: '2027-04-11',
    plannedEndDate: '2027-05-30',
    costAllocationUSD: 175000,
    progressPercentage: 0,
    relatedEvidenceIds: [],
    createdByUserId: 'usr_demo_director',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    isDemo: true,
  },
];

export class HybridMilestoneRepository implements IMilestoneRepository {
  private dataDir: string;
  private milestonesFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.milestonesFile = path.join(this.dataDir, 'milestones.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.milestonesFile)) {
        fs.writeFileSync(this.milestonesFile, JSON.stringify(INITIAL_DEMO_MILESTONES, null, 2), 'utf-8');
      } else {
        // Ensure initial demo milestones exist if file is empty
        const content = fs.readFileSync(this.milestonesFile, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        if (parsed.length === 0) {
          fs.writeFileSync(this.milestonesFile, JSON.stringify(INITIAL_DEMO_MILESTONES, null, 2), 'utf-8');
        }
      }
    } catch (err) {
      console.warn('[HybridMilestoneRepository] Local file init error:', err);
    }
  }

  private readAll(): ProjectMilestone[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.milestonesFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_MILESTONES];
    }
  }

  private writeAll(items: ProjectMilestone[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.milestonesFile, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridMilestoneRepository] Failed to write milestones:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_milestones');
  }

  async createMilestone(milestone: ProjectMilestone): Promise<ProjectMilestone> {
    const items = this.readAll();
    const existingIdx = items.findIndex(m => m.id === milestone.id);
    if (existingIdx >= 0) {
      items[existingIdx] = milestone;
    } else {
      items.push(milestone);
    }
    this.writeAll(items);

    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        await col.doc(milestone.id).set(milestone);
      }
    }

    return milestone;
  }

  async getMilestoneById(id: string): Promise<ProjectMilestone | null> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.doc(id).get();
        if (snap.exists) return snap.data() as ProjectMilestone;
      }
    }

    const items = this.readAll();
    const found = items.find(m => m.id === id);
    if (found) return found;

    return INITIAL_DEMO_MILESTONES.find(m => m.id === id) || null;
  }

  async listMilestonesByProject(projectId: string): Promise<ProjectMilestone[]> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs
            .map(d => d.data() as ProjectMilestone)
            .sort((a, b) => a.sequence - b.sequence);
        }
      }
    }

    const items = this.readAll();
    const filtered = items.filter(m => m.projectId === projectId);
    if (filtered.length > 0) {
      return filtered.sort((a, b) => a.sequence - b.sequence);
    }

    if (projectId === 'proj-horizon-villa') {
      return [...INITIAL_DEMO_MILESTONES].sort((a, b) => a.sequence - b.sequence);
    }

    return [];
  }

  async getMilestonesByProjectId(projectId: string): Promise<ProjectMilestone[]> {
    return this.listMilestonesByProject(projectId);
  }

  async updateMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<ProjectMilestone> {
    const items = this.readAll();
    const index = items.findIndex(m => m.id === id);

    let updated: ProjectMilestone;
    if (index >= 0) {
      updated = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
    } else {
      const fallback = INITIAL_DEMO_MILESTONES.find(m => m.id === id);
      if (!fallback) {
        throw new Error(`Milestone ${id} not found`);
      }
      updated = {
        ...fallback,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      items.push(updated);
    }

    this.writeAll(items);

    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        await col.doc(id).set(updated, { merge: true });
      }
    }

    return updated;
  }
}

class DelegatingMilestoneRepository implements IMilestoneRepository {
  private hybrid = new HybridMilestoneRepository();
  private postgres = new PostgresMilestoneRepository();

  private getDelegate(): IMilestoneRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createMilestone(milestone: ProjectMilestone): Promise<ProjectMilestone> {
    return this.getDelegate().createMilestone(milestone);
  }
  getMilestoneById(id: string): Promise<ProjectMilestone | null> {
    return this.getDelegate().getMilestoneById(id);
  }
  listMilestonesByProject(projectId: string): Promise<ProjectMilestone[]> {
    return this.getDelegate().listMilestonesByProject(projectId);
  }
  getMilestonesByProjectId(projectId: string): Promise<ProjectMilestone[]> {
    return this.getDelegate().getMilestonesByProjectId(projectId);
  }
  updateMilestone(id: string, updates: Partial<ProjectMilestone>): Promise<ProjectMilestone> {
    return this.getDelegate().updateMilestone(id, updates);
  }
}

export const milestoneRepository = new DelegatingMilestoneRepository();
