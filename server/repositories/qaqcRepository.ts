import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { QAQCInspection } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresQaqcInspectionRepository } from '../db/postgresRepositories';

export interface IQAQCInspectionRepository {
  createInspection(inspection: QAQCInspection): Promise<QAQCInspection>;
  getInspectionById(id: string): Promise<QAQCInspection | null>;
  listInspectionsByProject(projectId: string): Promise<QAQCInspection[]>;
  listInspectionsByMilestone(milestoneId: string): Promise<QAQCInspection[]>;
  updateInspection(id: string, updates: Partial<QAQCInspection>): Promise<QAQCInspection>;
}

export const INITIAL_DEMO_INSPECTIONS: QAQCInspection[] = [
  {
    id: 'insp-demo-001',
    projectId: 'proj-horizon-villa',
    milestoneId: 'ms-hv-001',
    inspectorUserId: 'usr_demo_qa_auditor',
    inspectorRole: 'STRUCTURAL_QA_QC_AUDITOR',
    inspectorName: 'Dr. Elena Rostova, PE, SE (Auditor)',
    inspectionStatus: 'PENDING',
    inspectionType: 'CONCRETE_POUR',
    inspectionNotes: 'Pre-inspection scheduled for raft slab monolithic pour verification, core cylinder testing, and thermographic curing audit.',
    evidenceIds: ['ev-demo-001', 'ev-demo-002'],
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    isDemo: true,
  },
];

export class HybridQAQCInspectionRepository implements IQAQCInspectionRepository {
  private dataDir: string;
  private inspectionsFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.inspectionsFile = path.join(this.dataDir, 'qaqc_inspections.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.inspectionsFile)) {
        fs.writeFileSync(this.inspectionsFile, JSON.stringify(INITIAL_DEMO_INSPECTIONS, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[HybridQAQCInspectionRepository] Local file init error:', err);
    }
  }

  private readAll(): QAQCInspection[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.inspectionsFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_INSPECTIONS];
    }
  }

  private writeAll(items: QAQCInspection[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.inspectionsFile, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridQAQCInspectionRepository] Failed to write inspections:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_qaqc_inspections');
  }

  async createInspection(inspection: QAQCInspection): Promise<QAQCInspection> {
    const items = this.readAll();
    const existingIndex = items.findIndex(i => i.id === inspection.id);
    if (existingIndex >= 0) {
      items[existingIndex] = inspection;
    } else {
      items.push(inspection);
    }
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(inspection.id).set(inspection);
      } catch (err) {
        console.warn('[HybridQAQCInspectionRepository] Firestore set failed, using local file:', err);
      }
    }

    return inspection;
  }

  async getInspectionById(id: string): Promise<QAQCInspection | null> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.doc(id).get();
        if (snap.exists) {
          return snap.data() as QAQCInspection;
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.find(i => i.id === id) || null;
  }

  async listInspectionsByProject(projectId: string): Promise<QAQCInspection[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as QAQCInspection);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.projectId === projectId);
  }

  async listInspectionsByMilestone(milestoneId: string): Promise<QAQCInspection[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('milestoneId', '==', milestoneId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as QAQCInspection);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.milestoneId === milestoneId);
  }

  async updateInspection(id: string, updates: Partial<QAQCInspection>): Promise<QAQCInspection> {
    const items = this.readAll();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) {
      throw new Error(`Inspection with id ${id} not found`);
    }

    const updated: QAQCInspection = {
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    items[index] = updated;
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(id).update({
          ...updates,
          updatedAt: updated.updatedAt,
        });
      } catch {
        // ignore
      }
    }

    return updated;
  }
}

class DelegatingQAQCInspectionRepository implements IQAQCInspectionRepository {
  private hybrid = new HybridQAQCInspectionRepository();
  private postgres = new PostgresQaqcInspectionRepository();

  private getDelegate(): IQAQCInspectionRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createInspection(inspection: QAQCInspection): Promise<QAQCInspection> {
    return this.getDelegate().createInspection(inspection);
  }
  getInspectionById(id: string): Promise<QAQCInspection | null> {
    return this.getDelegate().getInspectionById(id);
  }
  listInspectionsByProject(projectId: string): Promise<QAQCInspection[]> {
    return this.getDelegate().listInspectionsByProject(projectId);
  }
  listInspectionsByMilestone(milestoneId: string): Promise<QAQCInspection[]> {
    return this.getDelegate().listInspectionsByMilestone(milestoneId);
  }
  updateInspection(id: string, updates: Partial<QAQCInspection>): Promise<QAQCInspection> {
    return this.getDelegate().updateInspection(id, updates);
  }
}

export const qaqcRepository = new DelegatingQAQCInspectionRepository();
