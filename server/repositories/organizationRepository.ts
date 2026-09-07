import fs from 'fs';
import path from 'path';
import { getFirebaseAdmin, getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ensureDemoDataSeeded, DEMO_ORGANIZATION } from '../data/demoSeed';
import { getPersistenceMode } from '../db/database';
import { PostgresOrganizationRepository } from '../db/postgresRepositories';

export type OrganizationType = 
  | 'INDIVIDUAL_DEVELOPER'
  | 'REAL_ESTATE_DEVELOPER'
  | 'CORPORATE'
  | 'INSTITUTIONAL'
  | 'PUBLIC_SECTOR'
  | 'OTHER';

export type OrganizationVerificationStatus = 
  | 'NOT_STARTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED';

export type OwnerAuthorityStatus = 
  | 'NOT_STARTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED';

export type OrganizationStatus = 
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  registrationNumber?: string;
  jurisdiction: string;
  country: string;
  address?: string;
  createdByUserId?: string;
  ownerUserId?: string;
  verificationStatus: OrganizationVerificationStatus;
  ownerAuthorityStatus: OwnerAuthorityStatus;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export type OrganizationRole = 'OWNER_ADMIN' | 'PROJECT_DIRECTOR' | 'CONTRACTOR' | 'QAQC_AUDITOR' | 'MEMBER' | 'OBSERVER';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  organizationRole: OrganizationRole;
  status: MembershipStatus;
  invitedByUserId?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface IOrganizationRepository {
  createOrganization(org: Organization): Promise<Organization>;
  getOrganizationById(id: string): Promise<Organization | null>;
  listOrganizationsByUser(userId: string): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null>;
  
  createMembership(membership: OrganizationMembership): Promise<OrganizationMembership>;
  getMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null>;
  listMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]>;
  listMembershipsByUser(userId: string): Promise<OrganizationMembership[]>;
}

// 1. Cloud Firestore Implementation
class FirestoreOrganizationRepository implements IOrganizationRepository {
  private getOrgCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) throw new Error('Firestore not initialized');
    return firestore.collection('structura_organizations');
  }

  private getMemberCol() {
    const firestore = getFirebaseFirestore();
    if (!firestore) throw new Error('Firestore not initialized');
    return firestore.collection('structura_memberships');
  }

  async createOrganization(org: Organization): Promise<Organization> {
    await this.getOrgCol().doc(org.id).set(org);
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const doc = await this.getOrgCol().doc(id).get();
    return doc.exists ? (doc.data() as Organization) : null;
  }

  async listOrganizationsByUser(userId: string): Promise<Organization[]> {
    const memberSnap = await this.getMemberCol()
      .where('userId', '==', userId)
      .where('status', '==', 'ACTIVE')
      .get();
    const orgIds = memberSnap.docs.map(d => d.data().organizationId as string);
    if (orgIds.length === 0) return [];

    const orgs: Organization[] = [];
    for (const orgId of orgIds) {
      const org = await this.getOrganizationById(orgId);
      if (org) orgs.push(org);
    }
    return orgs;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    const docRef = this.getOrgCol().doc(id);
    await docRef.update({ ...updates, updatedAt: new Date().toISOString() });
    const snap = await docRef.get();
    return snap.exists ? (snap.data() as Organization) : null;
  }

  async createMembership(membership: OrganizationMembership): Promise<OrganizationMembership> {
    await this.getMemberCol().doc(membership.id).set(membership);
    return membership;
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null> {
    const snap = await this.getMemberCol()
      .where('organizationId', '==', organizationId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as OrganizationMembership);
  }

  async listMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]> {
    const snap = await this.getMemberCol().where('organizationId', '==', organizationId).get();
    return snap.docs.map(d => d.data() as OrganizationMembership);
  }

  async listMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    const snap = await this.getMemberCol().where('userId', '==', userId).get();
    return snap.docs.map(d => d.data() as OrganizationMembership);
  }
}

// 2. Local File Sandbox Implementation
class FileOrganizationRepository implements IOrganizationRepository {
  private orgsFile = path.join(process.cwd(), 'data', 'organizations.json');
  private membersFile = path.join(process.cwd(), 'data', 'memberships.json');

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.orgsFile)) {
      fs.writeFileSync(this.orgsFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(this.membersFile)) {
      fs.writeFileSync(this.membersFile, JSON.stringify([], null, 2));
    }
    ensureDemoDataSeeded();
  }

  private readOrgs(): Organization[] {
    try {
      if (!fs.existsSync(this.orgsFile)) return [];
      const raw = fs.readFileSync(this.orgsFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private writeOrgs(orgs: Organization[]) {
    fs.writeFileSync(this.orgsFile, JSON.stringify(orgs, null, 2));
  }

  private readMembers(): OrganizationMembership[] {
    try {
      if (!fs.existsSync(this.membersFile)) return [];
      const raw = fs.readFileSync(this.membersFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private writeMembers(members: OrganizationMembership[]) {
    fs.writeFileSync(this.membersFile, JSON.stringify(members, null, 2));
  }

  async createOrganization(org: Organization): Promise<Organization> {
    const orgs = this.readOrgs();
    orgs.push(org);
    this.writeOrgs(orgs);
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const orgs = this.readOrgs();
    return orgs.find(o => o.id === id) || null;
  }

  async listOrganizationsByUser(userId: string): Promise<Organization[]> {
    const members = this.readMembers();
    const activeMemberships = members.filter(m => m.userId === userId && m.status === 'ACTIVE');
    const orgIds = new Set(activeMemberships.map(m => m.organizationId));
    const orgs = this.readOrgs();
    return orgs.filter(o => orgIds.has(o.id) || o.ownerUserId === userId || o.createdByUserId === userId);
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    const orgs = this.readOrgs();
    const index = orgs.findIndex(o => o.id === id);
    if (index === -1) return null;
    orgs[index] = { ...orgs[index], ...updates, updatedAt: new Date().toISOString() };
    this.writeOrgs(orgs);
    return orgs[index];
  }

  async createMembership(membership: OrganizationMembership): Promise<OrganizationMembership> {
    const members = this.readMembers();
    members.push(membership);
    this.writeMembers(members);
    return membership;
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null> {
    const members = this.readMembers();
    return members.find(m => m.organizationId === organizationId && m.userId === userId) || null;
  }

  async listMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]> {
    const members = this.readMembers();
    return members.filter(m => m.organizationId === organizationId);
  }

  async listMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    const members = this.readMembers();
    return members.filter(m => m.userId === userId);
  }
}

class HybridOrganizationRepository implements IOrganizationRepository {
  private firestore = new FirestoreOrganizationRepository();
  private file = new FileOrganizationRepository();
  private postgres = new PostgresOrganizationRepository();

  private getDelegate(): IOrganizationRepository {
    if (getPersistenceMode() === 'database') {
      return this.postgres;
    }
    if (process.env.STRUCTURA_AUTH_MODE !== 'sandbox' && getFirebaseFirestore()) {
      return this.firestore;
    }
    return this.file;
  }

  createOrganization(org: Organization): Promise<Organization> {
    return this.getDelegate().createOrganization(org);
  }
  async getOrganizationById(id: string): Promise<Organization | null> {
    const org = await this.getDelegate().getOrganizationById(id);
    if (!org && id === DEMO_ORGANIZATION.id) {
      return DEMO_ORGANIZATION;
    }
    return org;
  }
  listOrganizationsByUser(userId: string): Promise<Organization[]> {
    return this.getDelegate().listOrganizationsByUser(userId);
  }
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    return this.getDelegate().updateOrganization(id, updates);
  }
  createMembership(membership: OrganizationMembership): Promise<OrganizationMembership> {
    return this.getDelegate().createMembership(membership);
  }
  getMembership(organizationId: string, userId: string): Promise<OrganizationMembership | null> {
    return this.getDelegate().getMembership(organizationId, userId);
  }
  listMembershipsByOrg(organizationId: string): Promise<OrganizationMembership[]> {
    return this.getDelegate().listMembershipsByOrg(organizationId);
  }
  listMembershipsByUser(userId: string): Promise<OrganizationMembership[]> {
    return this.getDelegate().listMembershipsByUser(userId);
  }
}

export const organizationRepository = new HybridOrganizationRepository();
