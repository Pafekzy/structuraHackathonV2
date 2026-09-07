import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { NonConformanceReport } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresNcrRepository } from '../db/postgresRepositories';

export interface INCRRepository {
  createNCR(ncr: NonConformanceReport): Promise<NonConformanceReport>;
  getNCRById(id: string): Promise<NonConformanceReport | null>;
  listNCRsByProject(projectId: string): Promise<NonConformanceReport[]>;
  listNCRsByMilestone(milestoneId: string): Promise<NonConformanceReport[]>;
  updateNCR(id: string, updates: Partial<NonConformanceReport>): Promise<NonConformanceReport>;
}

export const INITIAL_DEMO_NCRS: NonConformanceReport[] = [];

export class HybridNCRRepository implements INCRRepository {
  private dataDir: string;
  private ncrsFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.ncrsFile = path.join(this.dataDir, 'ncrs.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.ncrsFile)) {
        fs.writeFileSync(this.ncrsFile, JSON.stringify(INITIAL_DEMO_NCRS, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[HybridNCRRepository] Local file init error:', err);
    }
  }

  private readAll(): NonConformanceReport[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.ncrsFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_NCRS];
    }
  }

  private writeAll(items: NonConformanceReport[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.ncrsFile, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridNCRRepository] Failed to write NCRs:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_ncrs');
  }

  async createNCR(ncr: NonConformanceReport): Promise<NonConformanceReport> {
    const items = this.readAll();
    const existingIndex = items.findIndex(i => i.id === ncr.id);
    if (existingIndex >= 0) {
      items[existingIndex] = ncr;
    } else {
      items.push(ncr);
    }
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(ncr.id).set(ncr);
      } catch (err) {
        console.warn('[HybridNCRRepository] Firestore set failed, using local file:', err);
      }
    }

    return ncr;
  }

  async getNCRById(id: string): Promise<NonConformanceReport | null> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.doc(id).get();
        if (snap.exists) {
          return snap.data() as NonConformanceReport;
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.find(i => i.id === id) || null;
  }

  async listNCRsByProject(projectId: string): Promise<NonConformanceReport[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as NonConformanceReport);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.projectId === projectId);
  }

  async listNCRsByMilestone(milestoneId: string): Promise<NonConformanceReport[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('milestoneId', '==', milestoneId).get();
        if (!snap.empty) {
          return snap.docs.map(doc => doc.data() as NonConformanceReport);
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.filter(i => i.milestoneId === milestoneId);
  }

  async updateNCR(id: string, updates: Partial<NonConformanceReport>): Promise<NonConformanceReport> {
    const items = this.readAll();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) {
      throw new Error(`NCR with id ${id} not found`);
    }

    const updated: NonConformanceReport = {
      ...items[index],
      ...updates,
    };
    items[index] = updated;
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(id).update(updates);
      } catch {
        // ignore
      }
    }

    return updated;
  }
}

class DelegatingNCRRepository implements INCRRepository {
  private hybrid = new HybridNCRRepository();
  private postgres = new PostgresNcrRepository();

  private getDelegate(): INCRRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createNCR(ncr: NonConformanceReport): Promise<NonConformanceReport> {
    return this.getDelegate().createNCR(ncr);
  }
  getNCRById(id: string): Promise<NonConformanceReport | null> {
    return this.getDelegate().getNCRById(id);
  }
  listNCRsByProject(projectId: string): Promise<NonConformanceReport[]> {
    return this.getDelegate().listNCRsByProject(projectId);
  }
  listNCRsByMilestone(milestoneId: string): Promise<NonConformanceReport[]> {
    return this.getDelegate().listNCRsByMilestone(milestoneId);
  }
  updateNCR(id: string, updates: Partial<NonConformanceReport>): Promise<NonConformanceReport> {
    return this.getDelegate().updateNCR(id, updates);
  }
}

export const ncrRepository = new DelegatingNCRRepository();
