import fs from 'fs';
import path from 'path';
import { getFirebaseAdmin, getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ensureDemoDataSeeded, DEMO_USERS } from '../data/demoSeed';
import { getPersistenceMode } from '../db/database';
import { PostgresUserRepository } from '../db/postgresRepositories';

export type PrimaryRole =
  | 'OWNER_CLIENT'
  | 'SENIOR_PROJECT_DIRECTOR'
  | 'GENERAL_CONTRACTOR'
  | 'STRUCTURAL_QA_QC_AUDITOR';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
export type IdentityStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ProfessionalVerificationStatus =
  | 'NOT_REQUIRED'
  | 'NOT_STARTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'UNVERIFIED';

export interface UserRoleDetails {
  entityType?: 'Individual' | 'Organization';
  country?: string;
  city?: string;
  organizationName?: string;
  intendedUse?: 'Personal Development' | 'Real Estate Development' | 'Corporate Project' | 'Public / Institutional Project' | 'Other';
  yearsExperience?: number;
  primaryDiscipline?: string;
  professionalBody?: string;
  registrationNumber?: string;
  companyName?: string;
  licenseNumber?: string;
  jurisdiction?: string;
  claimedCredentials?: string;
  yearsOperating?: number;
  specialties?: string[];
}

export interface UserProfile {
  id: string;
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  primaryRole: PrimaryRole;
  accountStatus: AccountStatus;
  identityStatus: IdentityStatus;
  professionalVerificationStatus: ProfessionalVerificationStatus;
  roleDetails?: UserRoleDetails;
  createdAt: string;
  updatedAt: string;
  // Optional password hash used exclusively for isolated local developer sandbox when external Firebase is unconfigured
  passwordHash?: string;
  isDemo?: boolean;
}

export interface IUserRepository {
  create(profile: UserProfile): Promise<UserProfile>;
  findById(id: string): Promise<UserProfile | null>;
  findByAuthUserId(authUserId: string): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<UserProfile | null>;
  update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null>;
  listAll(): Promise<UserProfile[]>;
}

// 1. Firestore Repository Implementation (for cloud persistence when Firebase Admin is configured)
class FirestoreUserRepository implements IUserRepository {
  private getCollection() {
    const firestore = getFirebaseFirestore();
    if (!firestore) throw new Error('Firebase Firestore not initialized');
    return firestore.collection('structura_users');
  }

  async create(profile: UserProfile): Promise<UserProfile> {
    const col = this.getCollection();
    const docRef = col.doc(profile.id);
    const dataToSave = { ...profile };
    delete dataToSave.passwordHash; // Never save password hashes to profile doc
    await docRef.set(dataToSave);
    return profile;
  }

  async findById(id: string): Promise<UserProfile | null> {
    const col = this.getCollection();
    const doc = await col.doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as UserProfile;
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfile | null> {
    const col = this.getCollection();
    const snapshot = await col.where('authUserId', '==', authUserId).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserProfile;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const col = this.getCollection();
    const snapshot = await col.where('email', '==', email.toLowerCase().trim()).limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserProfile;
  }

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const col = this.getCollection();
    const docRef = col.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return null;
    const cleanUpdates = { ...updates, updatedAt: new Date().toISOString() };
    delete cleanUpdates.passwordHash;
    await docRef.update(cleanUpdates);
    const updated = await docRef.get();
    return updated.data() as UserProfile;
  }

  async listAll(): Promise<UserProfile[]> {
    const col = this.getCollection();
    const snapshot = await col.get();
    return snapshot.docs.map(d => d.data() as UserProfile);
  }
}

// 2. Persistent Local File / Memory Repository (ensures durable server persistence without crashing when external Firebase is pending)
class FileUserRepository implements IUserRepository {
  private filePath: string;
  private memoryCache: Map<string, UserProfile> = new Map();

  constructor() {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.warn('[FileUserRepository] Could not create data directory, using in-memory store');
      }
    }
    this.filePath = path.join(dir, 'users.json');
    ensureDemoDataSeeded();
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: UserProfile[] = JSON.parse(raw);
        this.memoryCache.clear();
        for (const u of list) {
          this.memoryCache.set(u.id, u);
        }
        console.log(`[FileUserRepository] Loaded ${list.length} users from ${this.filePath}`);
      }
    } catch (e) {
      console.warn('[FileUserRepository] Error loading users file:', e);
    }
  }

  private saveToFile() {
    try {
      const list = Array.from(this.memoryCache.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[FileUserRepository] Error writing users file:', e);
    }
  }

  async create(profile: UserProfile): Promise<UserProfile> {
    this.memoryCache.set(profile.id, { ...profile });
    this.saveToFile();
    return profile;
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.memoryCache.get(id) || null;
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfile | null> {
    for (const u of this.memoryCache.values()) {
      if (u.authUserId === authUserId) return u;
    }
    return null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.toLowerCase().trim();
    for (const u of this.memoryCache.values()) {
      if (u.email.toLowerCase().trim() === normalized) return u;
    }
    return null;
  }

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const existing = this.memoryCache.get(id);
    if (!existing) return null;
    const updated: UserProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.memoryCache.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async listAll(): Promise<UserProfile[]> {
    return Array.from(this.memoryCache.values());
  }
}

// 3. Resilient Facade Repository
export class UserRepository implements IUserRepository {
  private firestoreRepo = new FirestoreUserRepository();
  private fileRepo = new FileUserRepository();
  private postgresRepo = new PostgresUserRepository();

  private getActiveRepo(): IUserRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo;
    }
    const adminApp = getFirebaseAdmin();
    if (adminApp) {
      return this.firestoreRepo;
    }
    return this.fileRepo;
  }

  async create(profile: UserProfile): Promise<UserProfile> {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo.create(profile);
    }
    // Always write to active repo, and mirror to local file repo for resilience in file mode
    try {
      const active = this.getActiveRepo();
      const res = await active.create(profile);
      if (active !== this.fileRepo) {
        await this.fileRepo.create(profile);
      }
      return res;
    } catch (e) {
      console.warn('[UserRepository] Active repo write failed, falling back to local file repo:', e);
      return this.fileRepo.create(profile);
    }
  }

  async findById(id: string): Promise<UserProfile | null> {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo.findById(id);
    }
    try {
      const res = await this.getActiveRepo().findById(id);
      if (res) return res;
    } catch (e) {
      // Fallback
    }
    const fromFile = await this.fileRepo.findById(id);
    if (fromFile) return fromFile;
    return DEMO_USERS.find(u => u.id === id) || null;
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfile | null> {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo.findByAuthUserId(authUserId);
    }
    try {
      const res = await this.getActiveRepo().findByAuthUserId(authUserId);
      if (res) return res;
    } catch (e) {
      // Fallback
    }
    const fromFile = await this.fileRepo.findByAuthUserId(authUserId);
    if (fromFile) return fromFile;
    return DEMO_USERS.find(u => u.authUserId === authUserId) || null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo.findByEmail(email);
    }
    try {
      const res = await this.getActiveRepo().findByEmail(email);
      if (res) return res;
    } catch (e) {
      // Fallback
    }
    const fromFile = await this.fileRepo.findByEmail(email);
    if (fromFile) return fromFile;
    const normalized = email.toLowerCase().trim();
    return DEMO_USERS.find(u => u.email.toLowerCase().trim() === normalized) || null;
  }

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo.update(id, updates);
    }
    try {
      const active = this.getActiveRepo();
      const res = await active.update(id, updates);
      if (active !== this.fileRepo) {
        await this.fileRepo.update(id, updates);
      }
      return res;
    } catch (e) {
      return this.fileRepo.update(id, updates);
    }
  }

  async listAll(): Promise<UserProfile[]> {
    if (getPersistenceMode() === 'database') {
      return this.postgresRepo.listAll();
    }
    try {
      return await this.getActiveRepo().listAll();
    } catch (e) {
      return this.fileRepo.listAll();
    }
  }
}

export const userRepository = new UserRepository();
