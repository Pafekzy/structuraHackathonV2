import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { PunchItem } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresPunchItemRepository } from '../db/postgresRepositories';

export interface IPunchItemRepository {
  createPunchItem(item: PunchItem): Promise<PunchItem>;
  getPunchItemById(id: string): Promise<PunchItem | null>;
  listPunchItemsByProject(projectId: string): Promise<PunchItem[]>;
  listPunchItemsByMilestone(projectId: string, milestoneId: string): Promise<PunchItem[]>;
  updatePunchItem(id: string, updates: Partial<PunchItem>): Promise<PunchItem | null>;
  getNextPunchNumber(projectId: string): Promise<string>;
}

export const INITIAL_DEMO_PUNCH_ITEMS: PunchItem[] = [
  {
    id: 'punch-oasis-001',
    projectId: 'proj-demo-oasis',
    number: 'PUNCH-001',
    milestoneId: 'ms-oasis-04',
    title: 'Perimeter EPDM Weather Seal Caulking Gaps at North Elevation Mullions',
    description: 'Minor continuous sealant gap (approx 150mm) identified between aluminum transom and curtain wall glazing unit at Grid Ref C-4 on level 3. Requires backing rod insertion and structural silicone weather sealant application.',
    category: 'ARCHITECTURAL',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    raisedByUserId: 'usr-demo-director',
    raisedByRole: 'SENIOR_PROJECT_DIRECTOR',
    raisedByName: 'Dr. Arthur Sterling',
    raisedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    assignedToUserId: 'usr-demo-contractor',
    assignedToRole: 'GENERAL_CONTRACTOR',
    assignedToName: 'Marcus Vance',
    assignedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    evidenceIds: ['ev-oasis-04-01'],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    isDemo: true,
  },
  {
    id: 'punch-oasis-002',
    projectId: 'proj-demo-oasis',
    number: 'PUNCH-002',
    milestoneId: 'ms-oasis-04',
    title: 'Acoustic Gasket Alignment on Secondary Entrance Air-Lock Doors',
    description: 'Neoprene acoustic seals slightly pinched at lower hinge assembly causing 4dB acoustic performance deviation. Requires realignment and torque calibration.',
    category: 'MEP',
    priority: 'LOW',
    status: 'READY_FOR_VERIFICATION',
    raisedByUserId: 'usr-demo-auditor',
    raisedByRole: 'STRUCTURAL_QA_QC_AUDITOR',
    raisedByName: 'Elena Rostova, PE',
    raisedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    assignedToUserId: 'usr-demo-contractor',
    assignedToRole: 'GENERAL_CONTRACTOR',
    assignedToName: 'Marcus Vance',
    assignedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    resolutionDescription: 'Gasket re-seated, hinge shims adjusted, and acoustic seal verified with calibrated decibel meter at 38 dB attenuation.',
    resolvedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    resolvedByUserId: 'usr-demo-contractor',
    resolvedByName: 'Marcus Vance',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    isDemo: true,
  },
  {
    id: 'punch-oasis-003',
    projectId: 'proj-demo-oasis',
    number: 'PUNCH-003',
    milestoneId: 'ms-oasis-03',
    title: 'Touch-Up Protective Intumescent Paint Coating on Column Baseplate C2',
    description: 'Surface scuffing during scaffolding demounting exposed 100mm² primer coat. Requires surface wire brush cleaning and 2 coats of Nullifire SC902 intumescent paint.',
    category: 'STRUCTURAL',
    priority: 'MEDIUM',
    status: 'CLOSED',
    raisedByUserId: 'usr-demo-auditor',
    raisedByRole: 'STRUCTURAL_QA_QC_AUDITOR',
    raisedByName: 'Elena Rostova, PE',
    raisedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    assignedToUserId: 'usr-demo-contractor',
    assignedToRole: 'GENERAL_CONTRACTOR',
    assignedToName: 'Marcus Vance',
    assignedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    resolutionDescription: 'Applied specified 2-pack intumescent paint meeting 120-minute fire resistance rating. Dry film thickness (DFT) gauge verified at 1250 microns.',
    resolvedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    resolvedByUserId: 'usr-demo-contractor',
    resolvedByName: 'Marcus Vance',
    verificationNotes: 'Elena Rostova inspected on-site with electromagnetic dry-film thickness gauge. Thickness certified at 1310 microns. Workmanship approved.',
    verifiedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    verifiedByUserId: 'usr-demo-auditor',
    verifiedByName: 'Elena Rostova, PE',
    closedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    closedByUserId: 'usr-demo-director',
    closedByName: 'Dr. Arthur Sterling',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    isDemo: true,
  },
];

class FirestorePunchItemRepository implements IPunchItemRepository {
  private getCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) throw new Error('Firestore not initialized');
    return firestore.collection('structura_punch_items');
  }

  async createPunchItem(item: PunchItem): Promise<PunchItem> {
    await this.getCol().doc(item.id).set(item);
    return item;
  }

  async getPunchItemById(id: string): Promise<PunchItem | null> {
    const doc = await this.getCol().doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as PunchItem;
  }

  async listPunchItemsByProject(projectId: string): Promise<PunchItem[]> {
    const snap = await this.getCol().where('projectId', '==', projectId).get();
    const items = snap.docs.map(d => d.data() as PunchItem);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listPunchItemsByMilestone(projectId: string, milestoneId: string): Promise<PunchItem[]> {
    const items = await this.listPunchItemsByProject(projectId);
    return items.filter(i => i.milestoneId === milestoneId);
  }

  async updatePunchItem(id: string, updates: Partial<PunchItem>): Promise<PunchItem | null> {
    const ref = this.getCol().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = {
      ...doc.data(),
      ...updates,
      updatedAt: new Date().toISOString(),
    } as PunchItem;
    await ref.set(updated, { merge: true });
    return updated;
  }

  async getNextPunchNumber(projectId: string): Promise<string> {
    const items = await this.listPunchItemsByProject(projectId);
    const count = items.length + 1;
    return `PUNCH-${String(count).padStart(3, '0')}`;
  }
}

class LocalFilePunchItemRepository implements IPunchItemRepository {
  private filePath = path.join(process.cwd(), 'data', 'punch_items.json');
  private items: Map<string, PunchItem> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const dataDir = path.dirname(this.filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: PunchItem[] = JSON.parse(raw);
        list.forEach(item => this.items.set(item.id, item));
      } else {
        INITIAL_DEMO_PUNCH_ITEMS.forEach(item => this.items.set(item.id, item));
        this.saveData();
      }
    } catch (e) {
      console.warn('LocalFilePunchItemRepository load error:', e);
      INITIAL_DEMO_PUNCH_ITEMS.forEach(item => this.items.set(item.id, item));
    }
  }

  private saveData() {
    try {
      const list = Array.from(this.items.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('LocalFilePunchItemRepository save error:', e);
    }
  }

  async createPunchItem(item: PunchItem): Promise<PunchItem> {
    this.items.set(item.id, item);
    this.saveData();
    return item;
  }

  async getPunchItemById(id: string): Promise<PunchItem | null> {
    return this.items.get(id) || null;
  }

  async listPunchItemsByProject(projectId: string): Promise<PunchItem[]> {
    const list = Array.from(this.items.values()).filter(i => i.projectId === projectId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listPunchItemsByMilestone(projectId: string, milestoneId: string): Promise<PunchItem[]> {
    const list = await this.listPunchItemsByProject(projectId);
    return list.filter(i => i.milestoneId === milestoneId);
  }

  async updatePunchItem(id: string, updates: Partial<PunchItem>): Promise<PunchItem | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated: PunchItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    this.saveData();
    return updated;
  }

  async getNextPunchNumber(projectId: string): Promise<string> {
    const list = await this.listPunchItemsByProject(projectId);
    const count = list.length + 1;
    return `PUNCH-${String(count).padStart(3, '0')}`;
  }
}

class DelegatingPunchItemRepository implements IPunchItemRepository {
  private file = new LocalFilePunchItemRepository();
  private firestore = new FirestorePunchItemRepository();
  private postgres = new PostgresPunchItemRepository();

  private getDelegate(): IPunchItemRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    if (getFirebaseFirestore()) {
      return this.firestore;
    }
    return this.file;
  }

  createPunchItem(item: PunchItem): Promise<PunchItem> {
    return this.getDelegate().createPunchItem(item);
  }
  getPunchItemById(id: string): Promise<PunchItem | null> {
    return this.getDelegate().getPunchItemById(id);
  }
  listPunchItemsByProject(projectId: string): Promise<PunchItem[]> {
    return this.getDelegate().listPunchItemsByProject(projectId);
  }
  listPunchItemsByMilestone(projectId: string, milestoneId: string): Promise<PunchItem[]> {
    return this.getDelegate().listPunchItemsByMilestone(projectId, milestoneId);
  }
  updatePunchItem(id: string, updates: Partial<PunchItem>): Promise<PunchItem | null> {
    return this.getDelegate().updatePunchItem(id, updates);
  }
  getNextPunchNumber(projectId: string): Promise<string> {
    return this.getDelegate().getNextPunchNumber(projectId);
  }
}

export const punchItemRepository: IPunchItemRepository = new DelegatingPunchItemRepository();
