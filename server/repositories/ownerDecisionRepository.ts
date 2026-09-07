import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { OwnerMilestoneDecision } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresOwnerDecisionRepository } from '../db/postgresRepositories';

export interface IOwnerDecisionRepository {
  createDecision(decision: OwnerMilestoneDecision): Promise<OwnerMilestoneDecision>;
  getDecisionById(id: string): Promise<OwnerMilestoneDecision | null>;
  listDecisionsByMilestone(milestoneId: string): Promise<OwnerMilestoneDecision[]>;
  listDecisionsByProject(projectId: string): Promise<OwnerMilestoneDecision[]>;
}

export const INITIAL_DEMO_OWNER_DECISIONS: OwnerMilestoneDecision[] = [];

export class HybridOwnerDecisionRepository implements IOwnerDecisionRepository {
  private dataDir: string;
  private file: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.file = path.join(this.dataDir, 'owner_decisions.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.file)) {
        fs.writeFileSync(this.file, JSON.stringify(INITIAL_DEMO_OWNER_DECISIONS, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[HybridOwnerDecisionRepository] Local file init error:', err);
    }
  }

  private readAll(): OwnerMilestoneDecision[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.file, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_OWNER_DECISIONS];
    }
  }

  private writeAll(items: OwnerMilestoneDecision[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.file, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridOwnerDecisionRepository] Failed to write decisions:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_owner_decisions');
  }

  async createDecision(decision: OwnerMilestoneDecision): Promise<OwnerMilestoneDecision> {
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
        console.warn('[HybridOwnerDecisionRepository] Firestore set failed, using local file:', err);
      }
    }

    return decision;
  }

  async getDecisionById(id: string): Promise<OwnerMilestoneDecision | null> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.doc(id).get();
        if (snap.exists) {
          return snap.data() as OwnerMilestoneDecision;
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.find(i => i.id === id) || null;
  }

  async listDecisionsByMilestone(milestoneId: string): Promise<OwnerMilestoneDecision[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('milestoneId', '==', milestoneId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as OwnerMilestoneDecision);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.milestoneId === milestoneId);
  }

  async listDecisionsByProject(projectId: string): Promise<OwnerMilestoneDecision[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as OwnerMilestoneDecision);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.projectId === projectId);
  }
}

class DelegatingOwnerDecisionRepository implements IOwnerDecisionRepository {
  private hybrid = new HybridOwnerDecisionRepository();
  private postgres = new PostgresOwnerDecisionRepository();

  private getDelegate(): IOwnerDecisionRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createDecision(decision: OwnerMilestoneDecision): Promise<OwnerMilestoneDecision> {
    return this.getDelegate().createDecision(decision);
  }
  getDecisionById(id: string): Promise<OwnerMilestoneDecision | null> {
    return this.getDelegate().getDecisionById(id);
  }
  listDecisionsByMilestone(milestoneId: string): Promise<OwnerMilestoneDecision[]> {
    return this.getDelegate().listDecisionsByMilestone(milestoneId);
  }
  listDecisionsByProject(projectId: string): Promise<OwnerMilestoneDecision[]> {
    return this.getDelegate().listDecisionsByProject(projectId);
  }
}

export const ownerDecisionRepository = new DelegatingOwnerDecisionRepository();
