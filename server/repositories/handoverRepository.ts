import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectHandover, HandoverChecklistItem } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresHandoverRepository } from '../db/postgresRepositories';

export interface IHandoverRepository {
  getHandoverByProject(projectId: string): Promise<ProjectHandover | null>;
  saveHandover(handover: ProjectHandover): Promise<ProjectHandover>;
  updateHandover(projectId: string, updates: Partial<ProjectHandover>): Promise<ProjectHandover | null>;
  updateChecklistItem(projectId: string, itemId: string, updates: Partial<HandoverChecklistItem>): Promise<ProjectHandover | null>;
}

export function generateDefaultHandoverChecklist(): HandoverChecklistItem[] {
  return [
    {
      id: 'ho-chk-01',
      title: 'Structural Stability & As-Built Verification Certificate',
      category: 'ENGINEERING',
      isRequired: true,
      isSatisfied: true,
      sourceReference: 'ev-oasis-03-01',
      notes: 'Signed structural compliance certificate issued by Elena Rostova, PE.',
    },
    {
      id: 'ho-chk-02',
      title: 'MEP & HVAC Life Safety Commissioning Records',
      category: 'COMMISSIONING',
      isRequired: true,
      isSatisfied: false,
      notes: 'Commissioning scheduled post-glazing enclosure completion.',
    },
    {
      id: 'ho-chk-03',
      title: 'Architectural Operations & Maintenance (O&M) Manuals',
      category: 'DOCUMENTATION',
      isRequired: true,
      isSatisfied: true,
      sourceReference: 'ev-oasis-04-02',
      notes: 'Facade maintenance, glazing cleaning cradle specifications, and window warranty dossiers uploaded.',
    },
    {
      id: 'ho-chk-04',
      title: 'Fire Protection & Egress Statutory Sign-Off',
      category: 'STATUTORY',
      isRequired: true,
      isSatisfied: false,
      notes: 'Pending final inspection by municipal civil defense authority upon firestop reinspection.',
    },
    {
      id: 'ho-chk-05',
      title: 'Keys, Access Control Credentials & Smart BMS Handover',
      category: 'OPERATIONS',
      isRequired: true,
      isSatisfied: false,
      notes: 'Digital keycards and building management system admin credentials ready for transfer.',
    },
    {
      id: 'ho-chk-06',
      title: 'Defects Liability Period (DLP) Escrow & Retainage Terms Agreed',
      category: 'COMMERCIAL',
      isRequired: true,
      isSatisfied: true,
      notes: '12-month DLP retainage terms locked under baseline contract conditions.',
    },
  ];
}

export const INITIAL_DEMO_HANDOVERS: ProjectHandover[] = [
  {
    id: 'handover-oasis',
    projectId: 'proj-demo-oasis',
    status: 'IN_PREPARATION',
    targetHandoverDate: '2026-11-30',
    preparedByUserId: 'usr-demo-director',
    preparedByRole: 'SENIOR_PROJECT_DIRECTOR',
    preparedByName: 'Dr. Arthur Sterling',
    preparedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    handoverNotes: 'Preliminary Handover Package prepared for Oasis Tower. Aggregating technical review approvals, structural inspection records, as-built drawings, and warranty schedules for Owner-Client acceptance.',
    includedRecordCounts: {
      milestones: 6,
      evidence: 8,
      technicalReviews: 4,
      qaqcInspections: 3,
      ncrs: 2,
      ownerDecisions: 3,
      projectDecisions: 1,
      rfis: 4,
      punchItems: 3,
      closeoutItems: 8,
    },
    checklist: generateDefaultHandoverChecklist(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    isDemo: true,
  },
];

class FirestoreHandoverRepository implements IHandoverRepository {
  private getCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) throw new Error('Firestore not initialized');
    return firestore.collection('structura_handover');
  }

  async getHandoverByProject(projectId: string): Promise<ProjectHandover | null> {
    const snap = await this.getCol().where('projectId', '==', projectId).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as ProjectHandover;
  }

  async saveHandover(handover: ProjectHandover): Promise<ProjectHandover> {
    await this.getCol().doc(handover.id).set(handover);
    return handover;
  }

  async updateHandover(projectId: string, updates: Partial<ProjectHandover>): Promise<ProjectHandover | null> {
    const current = await this.getHandoverByProject(projectId);
    if (!current) return null;
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.getCol().doc(current.id).set(updated, { merge: true });
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
}

class LocalFileHandoverRepository implements IHandoverRepository {
  private filePath = path.join(process.cwd(), 'data', 'handover.json');
  private handovers: Map<string, ProjectHandover> = new Map();

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
        const list: ProjectHandover[] = JSON.parse(raw);
        list.forEach(h => this.handovers.set(h.projectId, h));
      } else {
        INITIAL_DEMO_HANDOVERS.forEach(h => this.handovers.set(h.projectId, h));
        this.saveData();
      }
    } catch (e) {
      console.warn('LocalFileHandoverRepository load error:', e);
      INITIAL_DEMO_HANDOVERS.forEach(h => this.handovers.set(h.projectId, h));
    }
  }

  private saveData() {
    try {
      const list = Array.from(this.handovers.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('LocalFileHandoverRepository save error:', e);
    }
  }

  async getHandoverByProject(projectId: string): Promise<ProjectHandover | null> {
    return this.handovers.get(projectId) || null;
  }

  async saveHandover(handover: ProjectHandover): Promise<ProjectHandover> {
    this.handovers.set(handover.projectId, handover);
    this.saveData();
    return handover;
  }

  async updateHandover(projectId: string, updates: Partial<ProjectHandover>): Promise<ProjectHandover | null> {
    const current = this.handovers.get(projectId);
    if (!current) return null;
    const updated: ProjectHandover = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.handovers.set(projectId, updated);
    this.saveData();
    return updated;
  }

  async updateChecklistItem(projectId: string, itemId: string, updates: Partial<HandoverChecklistItem>): Promise<ProjectHandover | null> {
    const current = this.handovers.get(projectId);
    if (!current) return null;
    const checklist = current.checklist.map(item => {
      if (item.id === itemId) {
        return { ...item, ...updates };
      }
      return item;
    });
    return this.updateHandover(projectId, { checklist });
  }
}

class DelegatingHandoverRepository implements IHandoverRepository {
  private file = new LocalFileHandoverRepository();
  private firestore = new FirestoreHandoverRepository();
  private postgres = new PostgresHandoverRepository();

  private getDelegate(): IHandoverRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    if (getFirebaseFirestore()) {
      return this.firestore;
    }
    return this.file;
  }

  getHandoverByProject(projectId: string): Promise<ProjectHandover | null> {
    return this.getDelegate().getHandoverByProject(projectId);
  }
  saveHandover(handover: ProjectHandover): Promise<ProjectHandover> {
    return this.getDelegate().saveHandover(handover);
  }
  updateHandover(projectId: string, updates: Partial<ProjectHandover>): Promise<ProjectHandover | null> {
    return this.getDelegate().updateHandover(projectId, updates);
  }
  updateChecklistItem(projectId: string, itemId: string, updates: Partial<HandoverChecklistItem>): Promise<ProjectHandover | null> {
    return this.getDelegate().updateChecklistItem(projectId, itemId, updates);
  }
}

export const handoverRepository: IHandoverRepository = new DelegatingHandoverRepository();
