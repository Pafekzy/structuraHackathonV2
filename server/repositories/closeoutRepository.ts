import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectCloseout, CloseoutChecklistItem } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresCloseoutRepository } from '../db/postgresRepositories';

export interface ICloseoutRepository {
  getCloseoutByProject(projectId: string): Promise<ProjectCloseout | null>;
  saveCloseout(closeout: ProjectCloseout): Promise<ProjectCloseout>;
  updateCloseout(projectId: string, updates: Partial<ProjectCloseout>): Promise<ProjectCloseout | null>;
  updateChecklistItem(projectId: string, itemId: string, updates: Partial<CloseoutChecklistItem>): Promise<ProjectCloseout | null>;
}

export function generateDefaultCloseoutChecklist(closeoutId: string): CloseoutChecklistItem[] {
  return [
    {
      id: 'chk-ms-01',
      closeoutId,
      category: 'MILESTONES',
      title: 'Structural & Substructure Milestones Approved',
      description: 'Verify all structural, excavation, foundation, and core framing milestones (MS-01, MS-02, MS-03) have reached formal APPROVED status.',
      isRequired: true,
      isCompleted: true,
      completedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
      completedByName: 'Dr. Arthur Sterling',
      verifiedReferenceId: 'ms-oasis-03',
      notes: 'Foundation, basement retaining wall, and superstructure core RC frame approved and certified.',
    },
    {
      id: 'chk-ms-02',
      closeoutId,
      category: 'MILESTONES',
      title: 'Enclosure, Facade & Roof Glazing Milestones Completed',
      description: 'Verify that curtain wall glazing, EPDM seals, and roof deck thermal waterproofing have attained technical acceptance and Owner sign-off.',
      isRequired: true,
      isCompleted: false,
      notes: 'Milestone MS-04 currently in progress under technical review.',
    },
    {
      id: 'chk-qa-01',
      closeoutId,
      category: 'QA_QC',
      title: 'Structural QA/QC Inspection Clearance',
      description: 'Verify all required independent engineering inspections passed and no unresolved QA/QC holds exist on any work package.',
      isRequired: true,
      isCompleted: false,
      notes: 'Awaiting final envelope acoustic and water-tightness verification.',
    },
    {
      id: 'chk-ncr-01',
      closeoutId,
      category: 'NCRS',
      title: 'Non-Conformance Reports (NCR) Resolution',
      description: 'Confirm that all non-conformance reports, defect remediations, and reinspections are fully resolved and closed in the NCR register.',
      isRequired: true,
      isCompleted: false,
      notes: 'NCR-001 (rebar clearance) closed; NCR-002 (firestop penetration) awaiting reinspection sign-off.',
    },
    {
      id: 'chk-ev-01',
      closeoutId,
      category: 'EVIDENCE',
      title: 'As-Built Documentation & Mill Test Certificates',
      description: 'Confirm all steel mill test certs, concrete core cylinder crush reports (28-day), and high-resolution site photo archives are registered.',
      isRequired: true,
      isCompleted: true,
      completedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      completedByName: 'Elena Rostova, PE',
      verifiedReferenceId: 'ev-oasis-03-02',
      notes: 'All 28-day compression test certificates (52.4 MPa) recorded in Evidence Register.',
    },
    {
      id: 'chk-dec-01',
      closeoutId,
      category: 'PROJECT_DECISIONS',
      title: 'Project Decisions & Variations Closure',
      description: 'Verify all proposed design variations, material selections, and budget adjustments have reached DECIDED or SUPERSEDED status.',
      isRequired: true,
      isCompleted: true,
      completedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      completedByName: 'Dr. Arthur Sterling',
      verifiedReferenceId: 'dec-oasis-001',
      notes: 'DEC-001 (curtain wall glazing spec) finalized.',
    },
    {
      id: 'chk-punch-01',
      closeoutId,
      category: 'PUNCH_ITEMS',
      title: 'Critical Punch List & Outstanding Items Clearance',
      description: 'Confirm all HIGH and CRITICAL priority punch items are verified and closed prior to final handover consideration.',
      isRequired: true,
      isCompleted: false,
      notes: '2 open minor architectural/MEP punch items currently undergoing contractor resolution.',
    },
    {
      id: 'chk-gov-01',
      closeoutId,
      category: 'GOVERNANCE',
      title: 'Owner-Client Final Governance & Payout Review',
      description: 'Ensure Owner/Client has reviewed final completion dossier, authorized financial milestone processing, and confirmed statutory compliance.',
      isRequired: true,
      isCompleted: false,
      notes: 'Scheduled upon completion of enclosure and MEP commissioning packages.',
    },
  ];
}

export const INITIAL_DEMO_CLOSEOUTS: ProjectCloseout[] = [
  {
    id: 'closeout-oasis',
    projectId: 'proj-demo-oasis',
    status: 'IN_PROGRESS',
    initiatedByUserId: 'usr-demo-director',
    initiatedByRole: 'SENIOR_PROJECT_DIRECTOR',
    initiatedByName: 'Dr. Arthur Sterling',
    initiatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    summary: 'Project closeout framework established for Oasis Tower. Governance checklist tracking structural completion, QA/QC audits, NCR closures, and handover dossier readiness.',
    checklist: generateDefaultCloseoutChecklist('closeout-oasis'),
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    isDemo: true,
  },
];

class FirestoreCloseoutRepository implements ICloseoutRepository {
  private getCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) throw new Error('Firestore not initialized');
    return firestore.collection('structura_closeout');
  }

  async getCloseoutByProject(projectId: string): Promise<ProjectCloseout | null> {
    const snap = await this.getCol().where('projectId', '==', projectId).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as ProjectCloseout;
  }

  async saveCloseout(closeout: ProjectCloseout): Promise<ProjectCloseout> {
    await this.getCol().doc(closeout.id).set(closeout);
    return closeout;
  }

  async updateCloseout(projectId: string, updates: Partial<ProjectCloseout>): Promise<ProjectCloseout | null> {
    const current = await this.getCloseoutByProject(projectId);
    if (!current) return null;
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.getCol().doc(current.id).set(updated, { merge: true });
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
}

class LocalFileCloseoutRepository implements ICloseoutRepository {
  private filePath = path.join(process.cwd(), 'data', 'closeout.json');
  private closeouts: Map<string, ProjectCloseout> = new Map();

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
        const list: ProjectCloseout[] = JSON.parse(raw);
        list.forEach(c => this.closeouts.set(c.projectId, c));
      } else {
        INITIAL_DEMO_CLOSEOUTS.forEach(c => this.closeouts.set(c.projectId, c));
        this.saveData();
      }
    } catch (e) {
      console.warn('LocalFileCloseoutRepository load error:', e);
      INITIAL_DEMO_CLOSEOUTS.forEach(c => this.closeouts.set(c.projectId, c));
    }
  }

  private saveData() {
    try {
      const list = Array.from(this.closeouts.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('LocalFileCloseoutRepository save error:', e);
    }
  }

  async getCloseoutByProject(projectId: string): Promise<ProjectCloseout | null> {
    return this.closeouts.get(projectId) || null;
  }

  async saveCloseout(closeout: ProjectCloseout): Promise<ProjectCloseout> {
    this.closeouts.set(closeout.projectId, closeout);
    this.saveData();
    return closeout;
  }

  async updateCloseout(projectId: string, updates: Partial<ProjectCloseout>): Promise<ProjectCloseout | null> {
    const current = this.closeouts.get(projectId);
    if (!current) return null;
    const updated: ProjectCloseout = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.closeouts.set(projectId, updated);
    this.saveData();
    return updated;
  }

  async updateChecklistItem(projectId: string, itemId: string, updates: Partial<CloseoutChecklistItem>): Promise<ProjectCloseout | null> {
    const current = this.closeouts.get(projectId);
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
}

class DelegatingCloseoutRepository implements ICloseoutRepository {
  private file = new LocalFileCloseoutRepository();
  private firestore = new FirestoreCloseoutRepository();
  private postgres = new PostgresCloseoutRepository();

  private getDelegate(): ICloseoutRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    if (getFirebaseFirestore()) {
      return this.firestore;
    }
    return this.file;
  }

  getCloseoutByProject(projectId: string): Promise<ProjectCloseout | null> {
    return this.getDelegate().getCloseoutByProject(projectId);
  }
  saveCloseout(closeout: ProjectCloseout): Promise<ProjectCloseout> {
    return this.getDelegate().saveCloseout(closeout);
  }
  updateCloseout(projectId: string, updates: Partial<ProjectCloseout>): Promise<ProjectCloseout | null> {
    return this.getDelegate().updateCloseout(projectId, updates);
  }
  updateChecklistItem(projectId: string, itemId: string, updates: Partial<CloseoutChecklistItem>): Promise<ProjectCloseout | null> {
    return this.getDelegate().updateChecklistItem(projectId, itemId, updates);
  }
}

export const closeoutRepository: ICloseoutRepository = new DelegatingCloseoutRepository();
