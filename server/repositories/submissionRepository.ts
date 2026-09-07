import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ContractorMilestoneSubmission } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresSubmissionRepository } from '../db/postgresRepositories';

export interface ISubmissionRepository {
  createSubmission(submission: ContractorMilestoneSubmission): Promise<ContractorMilestoneSubmission>;
  getSubmissionById(id: string): Promise<ContractorMilestoneSubmission | null>;
  getSubmissionByMilestone(projectId: string, milestoneId: string): Promise<ContractorMilestoneSubmission | null>;
  listSubmissionsByProject(projectId: string): Promise<ContractorMilestoneSubmission[]>;
  updateSubmission(id: string, updates: Partial<ContractorMilestoneSubmission>): Promise<ContractorMilestoneSubmission>;
}

export const INITIAL_DEMO_SUBMISSIONS: ContractorMilestoneSubmission[] = [
  {
    id: 'sub-hv-draft-001',
    projectId: 'proj-horizon-villa',
    milestoneId: 'ms-hv-001',
    submittedByUserId: 'usr_demo_contractor',
    submittedByRole: 'GENERAL_CONTRACTOR',
    submittedByName: 'Elena Rostova',
    status: 'DRAFT',
    title: 'Contractor Work Package Submission: Raft Slab Complete Pour & Cure',
    summary: 'Aegis EPC site operations team has completed subgrade leveling, dual-layer high-yield rebar placement, MEP sleeve blockouts, and monolithic C35/45 concrete pour. All 28-day break tests have met engineering criteria.',
    contractorNotes: 'Attached laboratory cylinder certificates demonstrate 48.2 MPa compressive strength against 45 MPa spec. Pre-pour photographic audit and HDPE waterproofing barrier sign-offs are indexed.',
    evidenceIds: ['ev-demo-001', 'ev-demo-002'],
    revisionNumber: 1,
    createdAt: '2026-03-30T10:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z',
    isDemo: true,
  },
];

export class HybridSubmissionRepository implements ISubmissionRepository {
  private dataDir: string;
  private submissionsFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.submissionsFile = path.join(this.dataDir, 'submissions.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.submissionsFile)) {
        fs.writeFileSync(this.submissionsFile, JSON.stringify(INITIAL_DEMO_SUBMISSIONS, null, 2), 'utf-8');
      } else {
        const content = fs.readFileSync(this.submissionsFile, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        if (parsed.length === 0) {
          fs.writeFileSync(this.submissionsFile, JSON.stringify(INITIAL_DEMO_SUBMISSIONS, null, 2), 'utf-8');
        }
      }
    } catch (err) {
      console.warn('[HybridSubmissionRepository] Local file init error:', err);
    }
  }

  private readAll(): ContractorMilestoneSubmission[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.submissionsFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_SUBMISSIONS];
    }
  }

  private writeAll(items: ContractorMilestoneSubmission[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.submissionsFile, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridSubmissionRepository] Failed to write submissions:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_submissions');
  }

  async createSubmission(submission: ContractorMilestoneSubmission): Promise<ContractorMilestoneSubmission> {
    const items = this.readAll();
    const existingIdx = items.findIndex(s => s.id === submission.id);
    if (existingIdx >= 0) {
      items[existingIdx] = submission;
    } else {
      items.push(submission);
    }
    this.writeAll(items);

    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        await col.doc(submission.id).set(submission);
      }
    }

    return submission;
  }

  async getSubmissionById(id: string): Promise<ContractorMilestoneSubmission | null> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.doc(id).get();
        if (snap.exists) return snap.data() as ContractorMilestoneSubmission;
      }
    }

    const items = this.readAll();
    const found = items.find(s => s.id === id);
    if (found) return found;

    return INITIAL_DEMO_SUBMISSIONS.find(s => s.id === id) || null;
  }

  async getSubmissionByMilestone(projectId: string, milestoneId: string): Promise<ContractorMilestoneSubmission | null> {
    const all = await this.listSubmissionsByProject(projectId);
    const matches = all.filter(s => s.milestoneId === milestoneId);
    if (matches.length === 0) return null;
    // Return latest revision or latest updated
    return matches.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  }

  async listSubmissionsByProject(projectId: string): Promise<ContractorMilestoneSubmission[]> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs
            .map(d => d.data() as ContractorMilestoneSubmission)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
      }
    }

    const items = this.readAll();
    const filtered = items.filter(s => s.projectId === projectId);
    if (filtered.length > 0) {
      return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    if (projectId === 'proj-horizon-villa') {
      return [...INITIAL_DEMO_SUBMISSIONS].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return [];
  }

  async updateSubmission(id: string, updates: Partial<ContractorMilestoneSubmission>): Promise<ContractorMilestoneSubmission> {
    const items = this.readAll();
    const index = items.findIndex(s => s.id === id);

    let updated: ContractorMilestoneSubmission;
    if (index >= 0) {
      updated = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
    } else {
      const fallback = INITIAL_DEMO_SUBMISSIONS.find(s => s.id === id);
      if (!fallback) {
        throw new Error(`Submission ${id} not found`);
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

class DelegatingSubmissionRepository implements ISubmissionRepository {
  private hybrid = new HybridSubmissionRepository();
  private postgres = new PostgresSubmissionRepository();

  private getDelegate(): ISubmissionRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createSubmission(submission: ContractorMilestoneSubmission): Promise<ContractorMilestoneSubmission> {
    return this.getDelegate().createSubmission(submission);
  }
  getSubmissionById(id: string): Promise<ContractorMilestoneSubmission | null> {
    return this.getDelegate().getSubmissionById(id);
  }
  getSubmissionByMilestone(projectId: string, milestoneId: string): Promise<ContractorMilestoneSubmission | null> {
    return this.getDelegate().getSubmissionByMilestone(projectId, milestoneId);
  }
  listSubmissionsByProject(projectId: string): Promise<ContractorMilestoneSubmission[]> {
    return this.getDelegate().listSubmissionsByProject(projectId);
  }
  updateSubmission(id: string, updates: Partial<ContractorMilestoneSubmission>): Promise<ContractorMilestoneSubmission> {
    return this.getDelegate().updateSubmission(id, updates);
  }
}

export const submissionRepository = new DelegatingSubmissionRepository();
