import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectDecision } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresProjectDecisionRepository } from '../db/postgresRepositories';

export interface IProjectDecisionRepository {
  createDecision(decision: ProjectDecision): Promise<ProjectDecision>;
  getDecisionById(id: string): Promise<ProjectDecision | null>;
  listDecisionsByProject(projectId: string): Promise<ProjectDecision[]>;
  getDecisionsByProjectId(projectId: string): Promise<ProjectDecision[]>;
  updateDecision(id: string, updates: Partial<ProjectDecision>): Promise<ProjectDecision | null>;
}

export const INITIAL_DEMO_PROJECT_DECISIONS: ProjectDecision[] = [
  {
    id: 'dec-oasis-001',
    projectId: 'proj-demo-oasis',
    number: 'DEC-001',
    title: 'Curtain Wall Facade Glazing Specification & Thermal Break System',
    subject: 'Approval of high-performance architectural double-glazed units with polyamide thermal breaks',
    description: 'Formal technical decision selecting Double-Glazed Argon-filled Low-E acoustic units (U-value 1.1 W/m²K) over standard monolithic glazing to satisfy LEED Gold energy performance criteria and statutory acoustic regulations along the transit corridor.',
    category: 'MATERIAL_SELECTION',
    status: 'DECIDED',
    options: [
      {
        id: 'opt-1',
        title: 'High-Performance Low-E Double Glazed (Polyamide Thermal Break)',
        description: 'Argon-filled 6mm/12mm/6mm Low-E coating. Sound transmission class (STC) 38. U-value 1.1 W/m²K.',
        costImpactUSD: 0,
        scheduleImpactDays: 0,
        isRecommended: true,
      },
      {
        id: 'opt-2',
        title: 'Triple-Glazed Crypton Infill',
        description: 'Maximum thermal insulation U-value 0.7 W/m²K, increased mullion structural loading requirement.',
        costImpactUSD: 48000,
        scheduleImpactDays: 14,
        isRecommended: false,
      },
    ],
    selectedOptionId: 'opt-1',
    selectedOutcome: 'Selected Option 1: High-Performance Low-E Double Glazed system with polyamide thermal breaks within baseline budget allocation.',
    rationale: 'Provides required thermal envelope compliance without structural dead-load penalties or delivery delays. Verified by Facade Engineering consultant and approved under Senior Project Director delegated authority.',
    proposedByUserId: 'usr-demo-contractor',
    proposedByRole: 'GENERAL_CONTRACTOR',
    proposedByName: 'Marcus Vance',
    decisionAuthorityUserId: 'usr-demo-director',
    decisionAuthorityRole: 'SENIOR_PROJECT_DIRECTOR',
    decisionAuthorityName: 'Dr. Arthur Sterling',
    participants: [
      {
        userId: 'usr-demo-contractor',
        role: 'GENERAL_CONTRACTOR',
        name: 'Marcus Vance',
      },
      {
        userId: 'usr-demo-director',
        role: 'SENIOR_PROJECT_DIRECTOR',
        name: 'Dr. Arthur Sterling',
      },
      {
        userId: 'usr-demo-auditor',
        role: 'STRUCTURAL_QA_QC_AUDITOR',
        name: 'Elena Rostova',
      },
    ],
    relatedRecordRefs: [
      {
        entityType: 'MILESTONE',
        entityId: 'ms-oasis-004',
        title: 'Milestone 4: Superstructure & Precast Framing',
      },
    ],
    createdAt: '2026-02-14T09:30:00.000Z',
    updatedAt: '2026-02-16T15:00:00.000Z',
    proposedAt: '2026-02-14T09:30:00.000Z',
    decidedAt: '2026-02-16T15:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'dec-oasis-002',
    projectId: 'proj-demo-oasis',
    number: 'DEC-002',
    title: 'Central Plant Heat-Recovery VRF Chiller Sequencing Configuration',
    subject: 'Evaluation of rooftop VRF condenser placement and vibration isolation springs',
    description: 'Engineering decision regarding rooftop acoustic isolation pads and dual-circuit refrigerant piping runs to eliminate low-frequency structural vibration transmission to top-floor penthouse suites.',
    category: 'DESIGN_VARIATION',
    status: 'PROPOSED',
    options: [
      {
        id: 'opt-201',
        title: 'Inertia Base Concrete Pad with 50mm Deflection Spring Mounts',
        description: 'Heavy inertia floating slab cast on rooftop structural slab with seismic-rated spring isolators.',
        costImpactUSD: 14500,
        scheduleImpactDays: 3,
        isRecommended: true,
      },
      {
        id: 'opt-202',
        title: 'Standard Neoprene Ribbed Waffle Pads',
        description: 'Direct pad mounting without spring deflection. Lower capital cost but elevated risk of structure-borne noise.',
        costImpactUSD: 2200,
        scheduleImpactDays: 0,
        isRecommended: false,
      },
    ],
    rationale: 'Acoustic testing reports recommend spring isolation to guarantee compliance with NC-30 indoor noise rating criteria.',
    proposedByUserId: 'usr-demo-director',
    proposedByRole: 'SENIOR_PROJECT_DIRECTOR',
    proposedByName: 'Dr. Arthur Sterling',
    participants: [
      {
        userId: 'usr-demo-director',
        role: 'SENIOR_PROJECT_DIRECTOR',
        name: 'Dr. Arthur Sterling',
      },
      {
        userId: 'usr-demo-contractor',
        role: 'GENERAL_CONTRACTOR',
        name: 'Marcus Vance',
      },
    ],
    relatedRecordRefs: [
      {
        entityType: 'MILESTONE',
        entityId: 'ms-oasis-004',
        title: 'Milestone 4: Superstructure & Precast Framing',
      },
    ],
    createdAt: '2026-02-28T11:00:00.000Z',
    updatedAt: '2026-02-28T11:00:00.000Z',
    proposedAt: '2026-02-28T11:00:00.000Z',
    isDemo: true,
  },
];

export class HybridProjectDecisionRepository implements IProjectDecisionRepository {
  private dataDir: string;
  private file: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.file = path.join(this.dataDir, 'project_decisions.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.file)) {
        fs.writeFileSync(this.file, JSON.stringify(INITIAL_DEMO_PROJECT_DECISIONS, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[HybridProjectDecisionRepository] Local file init error:', err);
    }
  }

  private readAll(): ProjectDecision[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.file, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_PROJECT_DECISIONS];
    }
  }

  private writeAll(items: ProjectDecision[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.file, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridProjectDecisionRepository] Failed to write decisions:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_project_decisions');
  }

  async createDecision(decision: ProjectDecision): Promise<ProjectDecision> {
    const items = this.readAll();
    const existingIndex = items.findIndex(i => i.id === decision.id);
    if (existingIndex >= 0) {
      items[existingIndex] = decision;
    } else {
      items.push(decision);
    }
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(decision.id).set(decision);
      } catch (err) {
        console.warn('[HybridProjectDecisionRepository] Firestore set failed, using local file:', err);
      }
    }

    return decision;
  }

  async getDecisionById(id: string): Promise<ProjectDecision | null> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.doc(id).get();
        if (snap.exists) {
          return snap.data() as ProjectDecision;
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.find(i => i.id === id) || null;
  }

  async listDecisionsByProject(projectId: string): Promise<ProjectDecision[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as ProjectDecision);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.projectId === projectId);
  }

  async getDecisionsByProjectId(projectId: string): Promise<ProjectDecision[]> {
    return this.listDecisionsByProject(projectId);
  }

  async updateDecision(id: string, updates: Partial<ProjectDecision>): Promise<ProjectDecision | null> {
    const items = this.readAll();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;

    const updated: ProjectDecision = {
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
      } catch (err) {
        console.warn('[HybridProjectDecisionRepository] Firestore update failed, using local file:', err);
      }
    }

    return updated;
  }
}

class DelegatingProjectDecisionRepository implements IProjectDecisionRepository {
  private hybrid = new HybridProjectDecisionRepository();
  private postgres = new PostgresProjectDecisionRepository();

  private getDelegate(): IProjectDecisionRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createDecision(decision: ProjectDecision): Promise<ProjectDecision> {
    return this.getDelegate().createDecision(decision);
  }
  getDecisionById(id: string): Promise<ProjectDecision | null> {
    return this.getDelegate().getDecisionById(id);
  }
  listDecisionsByProject(projectId: string): Promise<ProjectDecision[]> {
    return this.getDelegate().listDecisionsByProject(projectId);
  }
  getDecisionsByProjectId(projectId: string): Promise<ProjectDecision[]> {
    return this.getDelegate().getDecisionsByProjectId(projectId);
  }
  updateDecision(id: string, updates: Partial<ProjectDecision>): Promise<ProjectDecision | null> {
    return this.getDelegate().updateDecision(id, updates);
  }
}

export const projectDecisionRepository = new DelegatingProjectDecisionRepository();
