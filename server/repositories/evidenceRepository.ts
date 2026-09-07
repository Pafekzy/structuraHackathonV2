import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectEvidence } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresEvidenceRepository } from '../db/postgresRepositories';

export interface IEvidenceRepository {
  createEvidence(evidence: ProjectEvidence): Promise<ProjectEvidence>;
  getEvidenceById(id: string): Promise<ProjectEvidence | null>;
  listEvidenceByProject(projectId: string): Promise<ProjectEvidence[]>;
  listEvidenceByMilestone(projectId: string, milestoneId: string): Promise<ProjectEvidence[]>;
  updateEvidence(id: string, updates: Partial<ProjectEvidence>): Promise<ProjectEvidence>;
}

export const INITIAL_DEMO_EVIDENCE: ProjectEvidence[] = [
  {
    id: 'ev-demo-001',
    projectId: 'proj-horizon-villa',
    milestoneId: 'ms-hv-001',
    uploadedByUserId: 'usr_demo_contractor',
    uploadedByRole: 'GENERAL_CONTRACTOR',
    uploadedByName: 'Elena Rostova',
    evidenceType: 'TEST_RESULT',
    title: 'C35/45 Concrete Compressive 28-Day Cylinder Break Log',
    description: 'Certified third-party metallurgical and concrete laboratory break certificate verifying 48.2 MPa average compressive strength across 6 core cylinders, exceeding specified 45 MPa requirement.',
    fileName: 'horizon_villa_raft_slab_cylinder_test_28d.pdf',
    mimeType: 'application/pdf',
    fileSize: 2450000,
    storageProvider: 'METADATA_ONLY',
    storageStatus: 'RECORDED_METADATA',
    storageReference: 'CERT-LAB-2026-0881-RC',
    createdAt: '2026-03-28T14:30:00.000Z',
    updatedAt: '2026-03-28T14:30:00.000Z',
    metadata: {
      labName: 'Pacific Materials Testing Bureau (San Francisco)',
      batchNumber: 'BATCH-RC-4491',
      testedStrengthMPa: 48.2,
      specifiedStrengthMPa: 45.0,
      complianceResult: 'PASSED',
    },
    isDemo: true,
  },
  {
    id: 'ev-demo-002',
    projectId: 'proj-horizon-villa',
    milestoneId: 'ms-hv-001',
    uploadedByUserId: 'usr_demo_contractor',
    uploadedByRole: 'GENERAL_CONTRACTOR',
    uploadedByName: 'Elena Rostova',
    evidenceType: 'SITE_PHOTO',
    title: 'Foundation Raft Rebar Spacing & Blockout Placement Audit',
    description: 'High-resolution orthogonal photographic survey of Grid Lines 1 to 6 showing lower and upper T25 rebar mats, welded shear links, and MEP ground sleeve penetration seals.',
    fileName: 'horizon_villa_foundation_rebar_grid1_6.jpg',
    mimeType: 'image/jpeg',
    fileSize: 4820000,
    storageProvider: 'METADATA_ONLY',
    storageStatus: 'REFERENCED',
    storageReference: 'IMG-GEO-SITE-2026-0312-GRID1',
    createdAt: '2026-03-12T11:15:00.000Z',
    updatedAt: '2026-03-12T11:15:00.000Z',
    metadata: {
      station: 'Grid 3-B East Core',
      ambientTemp: '21°C',
      surveyMethod: 'Digital Photogrammetric Survey',
    },
    isDemo: true,
  },
  {
    id: 'ev-demo-003',
    projectId: 'proj-horizon-villa',
    milestoneId: 'ms-hv-001',
    uploadedByUserId: 'usr_demo_contractor',
    uploadedByRole: 'GENERAL_CONTRACTOR',
    uploadedByName: 'Elena Rostova',
    evidenceType: 'DOCUMENT',
    title: 'Sub-Slab Vapor Barrier & Waterproofing Membrane Warranty',
    description: 'Manufacturer pre-applied HDPE blindside sheet waterproofing membrane installation sign-off and 25-year structural warranty certificate.',
    fileName: 'preprufe_plus_waterproofing_signoff.pdf',
    mimeType: 'application/pdf',
    fileSize: 1820000,
    storageProvider: 'METADATA_ONLY',
    storageStatus: 'RECORDED_METADATA',
    storageReference: 'DOC-WPR-GCP-884102',
    createdAt: '2026-03-04T09:00:00.000Z',
    updatedAt: '2026-03-04T09:00:00.000Z',
    metadata: {
      manufacturer: 'GCP Applied Technologies',
      coverageAreaSqm: 680,
      inspectorSignature: 'VERIFIED_SITE_MEMO_09',
    },
    isDemo: true,
  },
];

export class HybridEvidenceRepository implements IEvidenceRepository {
  private dataDir: string;
  private evidenceFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.evidenceFile = path.join(this.dataDir, 'evidence.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.evidenceFile)) {
        fs.writeFileSync(this.evidenceFile, JSON.stringify(INITIAL_DEMO_EVIDENCE, null, 2), 'utf-8');
      } else {
        const content = fs.readFileSync(this.evidenceFile, 'utf-8');
        const parsed = JSON.parse(content || '[]');
        if (parsed.length === 0) {
          fs.writeFileSync(this.evidenceFile, JSON.stringify(INITIAL_DEMO_EVIDENCE, null, 2), 'utf-8');
        }
      }
    } catch (err) {
      console.warn('[HybridEvidenceRepository] Local file init error:', err);
    }
  }

  private readAll(): ProjectEvidence[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.evidenceFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_EVIDENCE];
    }
  }

  private writeAll(items: ProjectEvidence[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.evidenceFile, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridEvidenceRepository] Failed to write evidence:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_evidence');
  }

  async createEvidence(evidence: ProjectEvidence): Promise<ProjectEvidence> {
    const items = this.readAll();
    const existingIdx = items.findIndex(e => e.id === evidence.id);
    if (existingIdx >= 0) {
      items[existingIdx] = evidence;
    } else {
      items.push(evidence);
    }
    this.writeAll(items);

    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        await col.doc(evidence.id).set(evidence);
      }
    }

    return evidence;
  }

  async getEvidenceById(id: string): Promise<ProjectEvidence | null> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.doc(id).get();
        if (snap.exists) return snap.data() as ProjectEvidence;
      }
    }

    const items = this.readAll();
    const found = items.find(e => e.id === id);
    if (found) return found;

    return INITIAL_DEMO_EVIDENCE.find(e => e.id === id) || null;
  }

  async listEvidenceByProject(projectId: string): Promise<ProjectEvidence[]> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs
            .map(d => d.data() as ProjectEvidence)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    }

    const items = this.readAll();
    const filtered = items.filter(e => e.projectId === projectId);
    if (filtered.length > 0) {
      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    if (projectId === 'proj-horizon-villa') {
      return [...INITIAL_DEMO_EVIDENCE].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return [];
  }

  async listEvidenceByMilestone(projectId: string, milestoneId: string): Promise<ProjectEvidence[]> {
    const all = await this.listEvidenceByProject(projectId);
    return all.filter(e => e.milestoneId === milestoneId);
  }

  async updateEvidence(id: string, updates: Partial<ProjectEvidence>): Promise<ProjectEvidence> {
    const items = this.readAll();
    const index = items.findIndex(e => e.id === id);

    let updated: ProjectEvidence;
    if (index >= 0) {
      updated = {
        ...items[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      items[index] = updated;
    } else {
      const fallback = INITIAL_DEMO_EVIDENCE.find(e => e.id === id);
      if (!fallback) {
        throw new Error(`Evidence ${id} not found`);
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

class DelegatingEvidenceRepository implements IEvidenceRepository {
  private hybrid = new HybridEvidenceRepository();
  private postgres = new PostgresEvidenceRepository();

  private getDelegate(): IEvidenceRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createEvidence(evidence: ProjectEvidence): Promise<ProjectEvidence> {
    return this.getDelegate().createEvidence(evidence);
  }
  getEvidenceById(id: string): Promise<ProjectEvidence | null> {
    return this.getDelegate().getEvidenceById(id);
  }
  listEvidenceByProject(projectId: string): Promise<ProjectEvidence[]> {
    return this.getDelegate().listEvidenceByProject(projectId);
  }
  listEvidenceByMilestone(projectId: string, milestoneId: string): Promise<ProjectEvidence[]> {
    return this.getDelegate().listEvidenceByMilestone(projectId, milestoneId);
  }
  updateEvidence(id: string, updates: Partial<ProjectEvidence>): Promise<ProjectEvidence> {
    return this.getDelegate().updateEvidence(id, updates);
  }
}

export const evidenceRepository = new DelegatingEvidenceRepository();
