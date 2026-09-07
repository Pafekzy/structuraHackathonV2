import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ProjectNotification } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresNotificationRepository } from '../db/postgresRepositories';

export interface INotificationRepository {
  createNotification(notification: ProjectNotification): Promise<ProjectNotification>;
  getNotificationById(id: string): Promise<ProjectNotification | null>;
  listNotificationsByRecipient(projectId: string, recipientUserId: string): Promise<ProjectNotification[]>;
  listNotificationsByProject(projectId: string): Promise<ProjectNotification[]>;
  getNotificationsForUser(projectId: string, recipientUserId: string): Promise<ProjectNotification[]>;
  getNotificationsByProjectId(projectId: string): Promise<ProjectNotification[]>;
  markAsRead(id: string): Promise<ProjectNotification | null>;
  markAllAsRead(projectId: string, recipientUserId: string): Promise<number>;
  deleteNotification(id: string): Promise<boolean>;
}

export const INITIAL_DEMO_NOTIFICATIONS: ProjectNotification[] = [
  {
    id: 'notif-oasis-001',
    projectId: 'proj-demo-oasis',
    recipientUserId: 'usr-demo-contractor',
    recipientRole: 'GENERAL_CONTRACTOR',
    type: 'TECHNICAL_REVIEW_COMPLETED',
    title: 'Technical Review: Milestone 4 Package Accepted',
    message: 'Senior Project Director Dr. Arthur Sterling completed technical review for Milestone 4 and advanced package to QA/QC inspection hold point.',
    severity: 'INFO',
    relatedRecordType: 'TECHNICAL_REVIEW',
    relatedRecordId: 'sub-oasis-ms4-rev1',
    isRead: true,
    readAt: '2026-02-18T10:00:00.000Z',
    createdAt: '2026-02-17T14:30:00.000Z',
    isDemo: true,
  },
  {
    id: 'notif-oasis-002',
    projectId: 'proj-demo-oasis',
    recipientUserId: 'usr-demo-contractor',
    recipientRole: 'GENERAL_CONTRACTOR',
    type: 'NCR_ASSIGNED',
    title: 'Action Required: NCR-001 Issued',
    message: 'Structural QA/QC Auditor Elena Rostova raised NCR-001 regarding Grid Line C-4 shear wall vertical reinforcement spacing. Remediation plan required within 48 hours.',
    severity: 'ACTION_REQUIRED',
    relatedRecordType: 'NCR',
    relatedRecordId: 'ncr-oasis-001',
    isRead: false,
    createdAt: '2026-02-19T11:45:00.000Z',
    isDemo: true,
  },
  {
    id: 'notif-oasis-003',
    projectId: 'proj-demo-oasis',
    recipientUserId: 'usr-demo-owner',
    recipientRole: 'OWNER_CLIENT',
    type: 'OWNER_REVIEW_READY',
    title: 'Milestone 4 Ready for Owner Governance Review',
    message: 'QA/QC re-inspection has PASSED and NCR-001 is closed. Milestone 4 is now ready for formal Owner review and financial processing authorization.',
    severity: 'ACTION_REQUIRED',
    relatedRecordType: 'MILESTONE',
    relatedRecordId: 'ms-oasis-004',
    isRead: false,
    createdAt: '2026-02-23T16:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'notif-oasis-004',
    projectId: 'proj-demo-oasis',
    recipientUserId: 'usr-demo-director',
    recipientRole: 'SENIOR_PROJECT_DIRECTOR',
    type: 'PROJECT_DECISION_PROPOSED',
    title: 'Project Decision Proposed: VRF Chiller Vibration Mounts',
    message: 'Decision DEC-002 proposed for rooftop acoustic spring mounts. Technical evaluation and sign-off required.',
    severity: 'INFO',
    relatedRecordType: 'PROJECT_DECISION',
    relatedRecordId: 'dec-oasis-002',
    isRead: false,
    createdAt: '2026-02-28T11:00:00.000Z',
    isDemo: true,
  },
];

export class HybridNotificationRepository implements INotificationRepository {
  private dataDir: string;
  private file: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.file = path.join(this.dataDir, 'project_notifications.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (!fs.existsSync(this.file)) {
        fs.writeFileSync(this.file, JSON.stringify(INITIAL_DEMO_NOTIFICATIONS, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('[HybridNotificationRepository] Local file init error:', err);
    }
  }

  private readAll(): ProjectNotification[] {
    try {
      this.initFiles();
      const content = fs.readFileSync(this.file, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [...INITIAL_DEMO_NOTIFICATIONS];
    }
  }

  private writeAll(items: ProjectNotification[]): void {
    try {
      this.initFiles();
      fs.writeFileSync(this.file, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[HybridNotificationRepository] Failed to write notifications:', err);
    }
  }

  private getFirestoreCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) return null;
    return firestore.collection('structura_notifications');
  }

  async createNotification(notification: ProjectNotification): Promise<ProjectNotification> {
    const items = this.readAll();
    const existingIndex = items.findIndex(i => i.id === notification.id);
    if (existingIndex >= 0) {
      items[existingIndex] = notification;
    } else {
      items.push(notification);
    }
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(notification.id).set(notification);
      } catch (err) {
        console.warn('[HybridNotificationRepository] Firestore set failed, using local file:', err);
      }
    }

    return notification;
  }

  async getNotificationById(id: string): Promise<ProjectNotification | null> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.doc(id).get();
        if (snap.exists) {
          return snap.data() as ProjectNotification;
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items.find(i => i.id === id) || null;
  }

  async listNotificationsByRecipient(projectId: string, recipientUserId: string): Promise<ProjectNotification[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col
          .where('projectId', '==', projectId)
          .where('recipientUserId', '==', recipientUserId)
          .get();
        if (!snap.empty) {
          const list = snap.docs.map(doc => doc.data() as ProjectNotification);
          return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items
      .filter(i => i.projectId === projectId && i.recipientUserId === recipientUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listNotificationsByProject(projectId: string): Promise<ProjectNotification[]> {
    const col = this.getFirestoreCol();
    if (col) {
      try {
        const snap = await col.where('projectId', '==', projectId).get();
        if (!snap.empty) {
          const list = snap.docs.map(doc => doc.data() as ProjectNotification);
          return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } catch {
        // fallback
      }
    }

    const items = this.readAll();
    return items
      .filter(i => i.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getNotificationsForUser(projectId: string, recipientUserId: string): Promise<ProjectNotification[]> {
    return this.listNotificationsByRecipient(projectId, recipientUserId);
  }

  async getNotificationsByProjectId(projectId: string): Promise<ProjectNotification[]> {
    return this.listNotificationsByProject(projectId);
  }

  async markAsRead(id: string): Promise<ProjectNotification | null> {
    const items = this.readAll();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const updated: ProjectNotification = {
      ...items[index],
      isRead: true,
      readAt: now,
    };
    items[index] = updated;
    this.writeAll(items);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(id).update({
          isRead: true,
          readAt: now,
        });
      } catch (err) {
        console.warn('[HybridNotificationRepository] Firestore update failed, using local file:', err);
      }
    }

    return updated;
  }

  async markAllAsRead(projectId: string, recipientUserId: string): Promise<number> {
    const items = this.readAll();
    const now = new Date().toISOString();
    let count = 0;

    for (let i = 0; i < items.length; i++) {
      if (items[i].projectId === projectId && items[i].recipientUserId === recipientUserId && !items[i].isRead) {
        items[i].isRead = true;
        items[i].readAt = now;
        count++;
      }
    }

    if (count > 0) {
      this.writeAll(items);
    }

    const col = this.getFirestoreCol();
    if (col && count > 0) {
      try {
        const snap = await col
          .where('projectId', '==', projectId)
          .where('recipientUserId', '==', recipientUserId)
          .where('isRead', '==', false)
          .get();

        const batch = col.firestore.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, { isRead: true, readAt: now });
        });
        await batch.commit();
      } catch (err) {
        console.warn('[HybridNotificationRepository] Firestore batch update failed, using local file:', err);
      }
    }

    return count;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const items = this.readAll();
    const filtered = items.filter(i => i.id !== id);
    if (filtered.length === items.length) return false;

    this.writeAll(filtered);

    const col = this.getFirestoreCol();
    if (col) {
      try {
        await col.doc(id).delete();
      } catch (err) {
        console.warn('[HybridNotificationRepository] Firestore delete failed, using local file:', err);
      }
    }

    return true;
  }
}

class DelegatingNotificationRepository implements INotificationRepository {
  private hybrid = new HybridNotificationRepository();
  private postgres = new PostgresNotificationRepository();

  private getDelegate(): INotificationRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    return this.hybrid;
  }

  createNotification(notification: ProjectNotification): Promise<ProjectNotification> {
    return this.getDelegate().createNotification(notification);
  }
  getNotificationById(id: string): Promise<ProjectNotification | null> {
    return this.getDelegate().getNotificationById(id);
  }
  listNotificationsByRecipient(projectId: string, recipientUserId: string): Promise<ProjectNotification[]> {
    return this.getDelegate().listNotificationsByRecipient(projectId, recipientUserId);
  }
  listNotificationsByProject(projectId: string): Promise<ProjectNotification[]> {
    return this.getDelegate().listNotificationsByProject(projectId);
  }
  getNotificationsForUser(projectId: string, recipientUserId: string): Promise<ProjectNotification[]> {
    return this.getDelegate().getNotificationsForUser(projectId, recipientUserId);
  }
  getNotificationsByProjectId(projectId: string): Promise<ProjectNotification[]> {
    return this.getDelegate().getNotificationsByProjectId(projectId);
  }
  markAsRead(id: string): Promise<ProjectNotification | null> {
    return this.getDelegate().markAsRead(id);
  }
  markAllAsRead(projectId: string, recipientUserId: string): Promise<number> {
    return this.getDelegate().markAllAsRead(projectId, recipientUserId);
  }
  deleteNotification(id: string): Promise<boolean> {
    return this.getDelegate().deleteNotification(id);
  }
}

export const notificationRepository = new DelegatingNotificationRepository();
