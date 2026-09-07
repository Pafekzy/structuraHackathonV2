import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { RFI, RFIStatus, RFIPriority, ProjectRole } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresRfiRepository } from '../db/postgresRepositories';

export interface IRFIRepository {
  createRFI(data: {
    projectId: string;
    title: string;
    question: string;
    discipline: string;
    raisedByUserId: string;
    raisedByRole: ProjectRole;
    raisedByName: string;
    assignedToUserId: string;
    assignedToRole: ProjectRole;
    assignedToName: string;
    priority: RFIPriority;
    relatedMilestoneId?: string;
    relatedEvidenceIds?: string[];
    dueAt?: string;
  }): Promise<RFI>;
  getRFIById(id: string): Promise<RFI | null>;
  listRFIsByProject(projectId: string): Promise<RFI[]>;
  updateRFI(id: string, updates: Partial<RFI>): Promise<RFI>;
  getNextRFINumber(projectId: string): Promise<string>;
}

const INITIAL_DEMO_RFIS: RFI[] = [
  {
    id: 'rfi-demo-hv-001',
    projectId: 'proj-horizon-villa',
    number: 'RFI-001',
    title: 'Curtain Wall Mullion Thermal Break Verification & Anchor Embedment',
    question: 'Subcontractor requests confirmation of embed anchor bracket tolerance for Grid Line 4-A curtain wall transoms as per revised structural detail SD-204.',
    discipline: 'Facade & Envelope',
    raisedByUserId: 'usr_demo_contractor',
    raisedByRole: 'GENERAL_CONTRACTOR',
    raisedByName: 'Elena Rostova',
    assignedToUserId: 'usr_demo_director',
    assignedToRole: 'SENIOR_PROJECT_DIRECTOR',
    assignedToName: 'Marcus Vance',
    status: 'ANSWERED',
    priority: 'HIGH',
    response: 'Approved bracket slotted hole allowance up to 15mm with 6mm stainless shim pack. Use Hilti HIT-HY 200 epoxy anchors per structural note N-12.',
    respondedByUserId: 'usr_demo_director',
    respondedByName: 'Marcus Vance',
    respondedAt: '2026-08-22T14:30:00.000Z',
    createdAt: '2026-08-21T09:15:00.000Z',
    dueAt: '2026-08-25T17:00:00.000Z',
    updatedAt: '2026-08-22T14:30:00.000Z',
  },
  {
    id: 'rfi-demo-hv-002',
    projectId: 'proj-horizon-villa',
    number: 'RFI-002',
    title: 'Terrace Slab Post-Tensioning Anchorage Blockout Clash with Drain Core',
    question: 'Plumbing sleeve core 150mm on terrace balcony clashes with PT anchorage pocket tendon line T3. Requesting engineer recommendation on core relocation.',
    discipline: 'Structural & MEP Integration',
    raisedByUserId: 'usr_demo_contractor',
    raisedByRole: 'GENERAL_CONTRACTOR',
    raisedByName: 'Elena Rostova',
    assignedToUserId: 'usr_demo_director',
    assignedToRole: 'SENIOR_PROJECT_DIRECTOR',
    assignedToName: 'Marcus Vance',
    status: 'OPEN',
    priority: 'CRITICAL',
    createdAt: '2026-08-24T11:00:00.000Z',
    dueAt: '2026-08-27T17:00:00.000Z',
    updatedAt: '2026-08-24T11:00:00.000Z',
  },
];

export class HybridRFIRepository implements IRFIRepository {
  private dataDir: string;
  private rfisFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.rfisFile = path.join(this.dataDir, 'rfis.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.rfisFile)) {
        fs.writeFileSync(this.rfisFile, JSON.stringify(INITIAL_DEMO_RFIS, null, 2));
      }
    } catch (e) {
      console.error('[HybridRFIRepository] File init error:', e);
    }
  }

  private readRFIs(): RFI[] {
    try {
      if (fs.existsSync(this.rfisFile)) {
        return JSON.parse(fs.readFileSync(this.rfisFile, 'utf-8'));
      }
    } catch {
      // return fallback
    }
    return [];
  }

  private writeRFIs(rfis: RFI[]): void {
    fs.writeFileSync(this.rfisFile, JSON.stringify(rfis, null, 2));
  }

  async getNextRFINumber(projectId: string): Promise<string> {
    const list = await this.listRFIsByProject(projectId);
    const nextNum = list.length + 1;
    return `RFI-${String(nextNum).padStart(3, '0')}`;
  }

  async createRFI(data: {
    projectId: string;
    title: string;
    question: string;
    discipline: string;
    raisedByUserId: string;
    raisedByRole: ProjectRole;
    raisedByName: string;
    assignedToUserId: string;
    assignedToRole: ProjectRole;
    assignedToName: string;
    priority: RFIPriority;
    relatedMilestoneId?: string;
    relatedEvidenceIds?: string[];
    dueAt?: string;
  }): Promise<RFI> {
    const now = new Date().toISOString();
    const id = `rfi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const number = await this.getNextRFINumber(data.projectId);

    const rfi: RFI = {
      id,
      projectId: data.projectId,
      number,
      title: data.title,
      question: data.question,
      discipline: data.discipline,
      raisedByUserId: data.raisedByUserId,
      raisedByRole: data.raisedByRole,
      raisedByName: data.raisedByName,
      assignedToUserId: data.assignedToUserId,
      assignedToRole: data.assignedToRole,
      assignedToName: data.assignedToName,
      status: 'OPEN',
      priority: data.priority,
      relatedMilestoneId: data.relatedMilestoneId,
      relatedEvidenceIds: data.relatedEvidenceIds || [],
      createdAt: now,
      dueAt: data.dueAt,
      updatedAt: now,
    };

    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await firestore.collection('rfis').doc(id).set(rfi);
        return rfi;
      } catch (e) {
        console.warn('[HybridRFIRepository] Firestore createRFI failed, fallback to file:', e);
      }
    }

    const rfis = this.readRFIs();
    rfis.push(rfi);
    this.writeRFIs(rfis);
    return rfi;
  }

  async getRFIById(id: string): Promise<RFI | null> {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const doc = await firestore.collection('rfis').doc(id).get();
        if (doc.exists) {
          return doc.data() as RFI;
        }
      } catch (e) {
        console.warn('[HybridRFIRepository] Firestore getRFIById failed, fallback to file:', e);
      }
    }

    const rfis = this.readRFIs();
    return rfis.find(r => r.id === id) || null;
  }

  async listRFIsByProject(projectId: string): Promise<RFI[]> {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const snap = await firestore.collection('rfis')
          .where('projectId', '==', projectId)
          .get();
        if (!snap.empty) {
          return snap.docs
            .map(d => d.data() as RFI)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }
      } catch (e) {
        console.warn('[HybridRFIRepository] Firestore listRFIsByProject failed, fallback to file:', e);
      }
    }

    const rfis = this.readRFIs();
    return rfis
      .filter(r => r.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateRFI(id: string, updates: Partial<RFI>): Promise<RFI> {
    const now = new Date().toISOString();
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await firestore.collection('rfis').doc(id).update({
          ...updates,
          updatedAt: now,
        });
        const doc = await firestore.collection('rfis').doc(id).get();
        return doc.data() as RFI;
      } catch (e) {
        console.warn('[HybridRFIRepository] Firestore updateRFI failed, fallback to file:', e);
      }
    }

    const rfis = this.readRFIs();
    const idx = rfis.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error(`RFI ${id} not found`);
    }

    rfis[idx] = {
      ...rfis[idx],
      ...updates,
      updatedAt: now,
    };
    this.writeRFIs(rfis);
    return rfis[idx];
  }
}

class DelegatingRFIRepository implements IRFIRepository {
  private hybrid = new HybridRFIRepository();
  private postgres = new PostgresRfiRepository();

  private getDelegate(): IRFIRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createRFI(data: any): Promise<RFI> {
    return this.getDelegate().createRFI(data);
  }
  getRFIById(id: string): Promise<RFI | null> {
    return this.getDelegate().getRFIById(id);
  }
  listRFIsByProject(projectId: string): Promise<RFI[]> {
    return this.getDelegate().listRFIsByProject(projectId);
  }
  updateRFI(id: string, updates: Partial<RFI>): Promise<RFI> {
    return this.getDelegate().updateRFI(id, updates);
  }
  getNextRFINumber(projectId: string): Promise<string> {
    return this.getDelegate().getNextRFINumber(projectId);
  }
}

export const rfiRepository = new DelegatingRFIRepository();
