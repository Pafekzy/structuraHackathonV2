import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectDirectorTechnicalReview } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresTechnicalReviewRepository } from '../db/postgresRepositories';

export interface ITechnicalReviewRepository {
  createReview(review: ProjectDirectorTechnicalReview): Promise<ProjectDirectorTechnicalReview>;
  getReviewById(id: string): Promise<ProjectDirectorTechnicalReview | null>;
  listReviewsByProject(projectId: string): Promise<ProjectDirectorTechnicalReview[]>;
  listReviewsBySubmission(submissionId: string): Promise<ProjectDirectorTechnicalReview[]>;
  updateReview(id: string, updates: Partial<ProjectDirectorTechnicalReview>): Promise<ProjectDirectorTechnicalReview>;
}

export const INITIAL_DEMO_REVIEWS: ProjectDirectorTechnicalReview[] = [];

export class HybridTechnicalReviewRepository implements ITechnicalReviewRepository {
  private dataDir: string;
  private reviewsFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.reviewsFile = path.join(this.dataDir, 'technical_reviews.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.reviewsFile)) {
        fs.writeFileSync(this.reviewsFile, JSON.stringify(INITIAL_DEMO_REVIEWS, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[HybridTechnicalReviewRepository] Local file init error:', err);
    }
  }

  private readAll(): ProjectDirectorTechnicalReview[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.reviewsFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_REVIEWS];
    }
  }

  private writeAll(items: ProjectDirectorTechnicalReview[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.reviewsFile, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridTechnicalReviewRepository] Failed to write reviews:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_technical_reviews');
  }

  async createReview(review: ProjectDirectorTechnicalReview): Promise<ProjectDirectorTechnicalReview> {
    const items = this.readAll();
    const existingIdx = items.findIndex(r => r.id === review.id);
    if (existingIdx >= 0) {
      items[existingIdx] = review;
    } else {
      items.push(review);
    }
    this.writeAll(items);

    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        await col.doc(review.id).set(review);
      }
    }

    return review;
  }

  async getReviewById(id: string): Promise<ProjectDirectorTechnicalReview | null> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.doc(id).get();
        if (snap.exists) return snap.data() as ProjectDirectorTechnicalReview;
      }
    }

    const items = this.readAll();
    return items.find(r => r.id === id) || null;
  }

  async listReviewsByProject(projectId: string): Promise<ProjectDirectorTechnicalReview[]> {
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox') {
      const col = this.getFirestoreCol();
      if (col) {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          return snap.docs
            .map(d => d.data() as ProjectDirectorTechnicalReview)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    }

    const items = this.readAll();
    return items
      .filter(r => r.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listReviewsBySubmission(submissionId: string): Promise<ProjectDirectorTechnicalReview[]> {
    const items = this.readAll();
    return items
      .filter(r => r.submissionId === submissionId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateReview(id: string, updates: Partial<ProjectDirectorTechnicalReview>): Promise<ProjectDirectorTechnicalReview> {
    const items = this.readAll();
    const index = items.findIndex(r => r.id === id);

    let updated: ProjectDirectorTechnicalReview;
    if (index >= 0) {
      updated = {
        ...items[index],
        ...updates,
      };
      items[index] = updated;
    } else {
      throw new Error(`Review ${id} not found`);
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

class DelegatingTechnicalReviewRepository implements ITechnicalReviewRepository {
  private hybrid = new HybridTechnicalReviewRepository();
  private postgres = new PostgresTechnicalReviewRepository();

  private getDelegate(): ITechnicalReviewRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createReview(review: ProjectDirectorTechnicalReview): Promise<ProjectDirectorTechnicalReview> {
    return this.getDelegate().createReview(review);
  }
  getReviewById(id: string): Promise<ProjectDirectorTechnicalReview | null> {
    return this.getDelegate().getReviewById(id);
  }
  listReviewsByProject(projectId: string): Promise<ProjectDirectorTechnicalReview[]> {
    return this.getDelegate().listReviewsByProject(projectId);
  }
  listReviewsBySubmission(submissionId: string): Promise<ProjectDirectorTechnicalReview[]> {
    return this.getDelegate().listReviewsBySubmission(submissionId);
  }
  updateReview(id: string, updates: Partial<ProjectDirectorTechnicalReview>): Promise<ProjectDirectorTechnicalReview> {
    return this.getDelegate().updateReview(id, updates);
  }
}

export const technicalReviewRepository = new DelegatingTechnicalReviewRepository();
