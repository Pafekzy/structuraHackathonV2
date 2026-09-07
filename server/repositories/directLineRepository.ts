import fs from 'fs';
import path from 'path';
import { getFirebaseFirestore } from '../auth/firebaseAdmin';
import { ChannelType, DirectLineMessageType, ProjectConversation, ProjectMessage, ProjectRole } from '../../src/types';
import { getPersistenceMode } from '../db/database';
import { PostgresDirectLineRepository } from '../db/postgresRepositories';

export interface IDirectLineRepository {
  getOrCreateConversation(projectId: string, channelType: ChannelType): Promise<ProjectConversation>;
  getConversationsByProject(projectId: string): Promise<ProjectConversation[]>;
  getConversationById(id: string): Promise<ProjectConversation | null>;
  addMessage(data: {
    projectId: string;
    channelType: ChannelType;
    senderUserId: string;
    senderRole: ProjectRole;
    senderName: string;
    messageType: DirectLineMessageType;
    subject?: string;
    content: string;
    relatedEntityId?: string;
  }): Promise<ProjectMessage>;
  getMessagesByChannel(projectId: string, channelType: ChannelType): Promise<ProjectMessage[]>;
}

export function getChannelParticipantRoles(channelType: ChannelType): [ProjectRole, ProjectRole] {
  switch (channelType) {
    case 'OWNER_DIRECTOR':
      return ['OWNER_CLIENT', 'SENIOR_PROJECT_DIRECTOR'];
    case 'OWNER_QAQC':
      return ['OWNER_CLIENT', 'STRUCTURAL_QA_QC_AUDITOR'];
    case 'DIRECTOR_CONTRACTOR':
      return ['SENIOR_PROJECT_DIRECTOR', 'GENERAL_CONTRACTOR'];
  }
}

// Initial demo messages for Horizon Villa
const INITIAL_DEMO_MESSAGES: ProjectMessage[] = [
  {
    id: 'msg-demo-hv-1',
    conversationId: 'conv-proj-horizon-villa-OWNER_DIRECTOR',
    projectId: 'proj-horizon-villa',
    channelType: 'OWNER_DIRECTOR',
    senderUserId: 'usr_demo_owner',
    senderRole: 'OWNER_CLIENT',
    senderName: 'Alexander Vance',
    messageType: 'INSTRUCTION',
    subject: 'Stage 4 Glazing & Envelope Milestone Verification',
    content: 'Please verify the thermal-break curtain wall extrusions and glazing spec compliance before we approve the next disbursement schedule.',
    createdAt: '2026-08-20T10:30:00.000Z',
  },
  {
    id: 'msg-demo-hv-2',
    conversationId: 'conv-proj-horizon-villa-OWNER_DIRECTOR',
    projectId: 'proj-horizon-villa',
    channelType: 'OWNER_DIRECTOR',
    senderUserId: 'usr_demo_director',
    senderRole: 'SENIOR_PROJECT_DIRECTOR',
    senderName: 'Marcus Vance',
    messageType: 'INFORMATION',
    subject: 'Re: Stage 4 Glazing & Envelope Milestone Verification',
    content: 'Confirmed. Aegis EPC staged shipments at port customs. Acoustic and U-value test certificates are logged in the project repository.',
    createdAt: '2026-08-20T14:15:00.000Z',
  },
  {
    id: 'msg-demo-hv-3',
    conversationId: 'conv-proj-horizon-villa-DIRECTOR_CONTRACTOR',
    projectId: 'proj-horizon-villa',
    channelType: 'DIRECTOR_CONTRACTOR',
    senderUserId: 'usr_demo_director',
    senderRole: 'SENIOR_PROJECT_DIRECTOR',
    senderName: 'Marcus Vance',
    messageType: 'CLARIFICATION_REQUEST',
    subject: 'Level 2 Terrace Transfer Beam Inspection',
    content: 'Structural QA/QC flagged rebar spacing at Grid C-4. Please ensure rebar clearance logs and mill test reports are uploaded prior to Friday concrete pour.',
    createdAt: '2026-08-22T09:00:00.000Z',
  },
  {
    id: 'msg-demo-hv-4',
    conversationId: 'conv-proj-horizon-villa-DIRECTOR_CONTRACTOR',
    projectId: 'proj-horizon-villa',
    channelType: 'DIRECTOR_CONTRACTOR',
    senderUserId: 'usr_demo_contractor',
    senderRole: 'GENERAL_CONTRACTOR',
    senderName: 'Elena Rostova',
    messageType: 'ACKNOWLEDGEMENT',
    subject: 'Re: Level 2 Terrace Transfer Beam Inspection',
    content: 'Clearance logs and 3D point cloud scan have been attached to RFI-001. Awaiting formal engineering sign-off from director and QA team.',
    createdAt: '2026-08-22T11:45:00.000Z',
  },
  {
    id: 'msg-demo-hv-5',
    conversationId: 'conv-proj-horizon-villa-OWNER_QAQC',
    projectId: 'proj-horizon-villa',
    channelType: 'OWNER_QAQC',
    senderUserId: 'usr_demo_owner',
    senderRole: 'OWNER_CLIENT',
    senderName: 'Alexander Vance',
    messageType: 'INSTRUCTION',
    subject: 'Seismic Joint & Post-Tensioned Slab Independent Audit',
    content: 'Requesting independent ultrasonic testing report on post-tensioned anchor heads for Level 2 slab before structural acceptance.',
    createdAt: '2026-08-23T08:30:00.000Z',
  },
  {
    id: 'msg-demo-hv-6',
    conversationId: 'conv-proj-horizon-villa-OWNER_QAQC',
    projectId: 'proj-horizon-villa',
    channelType: 'OWNER_QAQC',
    senderUserId: 'usr_demo_qaqc',
    senderRole: 'STRUCTURAL_QA_QC_AUDITOR',
    senderName: 'Dr. David Chen',
    messageType: 'INFORMATION',
    subject: 'Re: Seismic Joint & Post-Tensioned Slab Independent Audit',
    content: 'Non-destructive ultrasonic testing is scheduled for Tuesday morning. All calibration data and sensor logs will be posted to the audit vault.',
    createdAt: '2026-08-23T10:00:00.000Z',
  },
];

export class HybridDirectLineRepository implements IDirectLineRepository {
  private dataDir: string;
  private conversationsFile: string;
  private messagesFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.conversationsFile = path.join(this.dataDir, 'project_conversations.json');
    this.messagesFile = path.join(this.dataDir, 'project_messages.json');
    this.initFiles();
  }

  private initFiles(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Initialize conversations file
      if (!fs.existsSync(this.conversationsFile)) {
        const initialConversations: ProjectConversation[] = [
          {
            id: 'conv-proj-horizon-villa-OWNER_DIRECTOR',
            projectId: 'proj-horizon-villa',
            channelType: 'OWNER_DIRECTOR',
            participantRoles: ['OWNER_CLIENT', 'SENIOR_PROJECT_DIRECTOR'],
            createdAt: '2026-08-20T10:00:00.000Z',
            updatedAt: '2026-08-20T14:15:00.000Z',
            lastMessageSnippet: 'Confirmed. Aegis EPC staged shipments at port customs...',
            lastMessageAt: '2026-08-20T14:15:00.000Z',
          },
          {
            id: 'conv-proj-horizon-villa-DIRECTOR_CONTRACTOR',
            projectId: 'proj-horizon-villa',
            channelType: 'DIRECTOR_CONTRACTOR',
            participantRoles: ['SENIOR_PROJECT_DIRECTOR', 'GENERAL_CONTRACTOR'],
            createdAt: '2026-08-22T08:30:00.000Z',
            updatedAt: '2026-08-22T11:45:00.000Z',
            lastMessageSnippet: 'Clearance logs and 3D point cloud scan have been attached to RFI-001...',
            lastMessageAt: '2026-08-22T11:45:00.000Z',
          },
          {
            id: 'conv-proj-horizon-villa-OWNER_QAQC',
            projectId: 'proj-horizon-villa',
            channelType: 'OWNER_QAQC',
            participantRoles: ['OWNER_CLIENT', 'STRUCTURAL_QA_QC_AUDITOR'],
            createdAt: '2026-08-23T08:00:00.000Z',
            updatedAt: '2026-08-23T10:00:00.000Z',
            lastMessageSnippet: 'Non-destructive ultrasonic testing is scheduled for Tuesday morning...',
            lastMessageAt: '2026-08-23T10:00:00.000Z',
          },
        ];
        fs.writeFileSync(this.conversationsFile, JSON.stringify(initialConversations, null, 2));
      }

      // Initialize messages file
      if (!fs.existsSync(this.messagesFile)) {
        fs.writeFileSync(this.messagesFile, JSON.stringify(INITIAL_DEMO_MESSAGES, null, 2));
      }
    } catch (e) {
      console.error('[HybridDirectLineRepository] File init error:', e);
    }
  }

  private readConversations(): ProjectConversation[] {
    try {
      if (fs.existsSync(this.conversationsFile)) {
        return JSON.parse(fs.readFileSync(this.conversationsFile, 'utf-8'));
      }
    } catch {
      // return fallback
    }
    return [];
  }

  private writeConversations(conversations: ProjectConversation[]): void {
    fs.writeFileSync(this.conversationsFile, JSON.stringify(conversations, null, 2));
  }

  private readMessages(): ProjectMessage[] {
    try {
      if (fs.existsSync(this.messagesFile)) {
        return JSON.parse(fs.readFileSync(this.messagesFile, 'utf-8'));
      }
    } catch {
      // return fallback
    }
    return [];
  }

  private writeMessages(messages: ProjectMessage[]): void {
    fs.writeFileSync(this.messagesFile, JSON.stringify(messages, null, 2));
  }

  async getOrCreateConversation(projectId: string, channelType: ChannelType): Promise<ProjectConversation> {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const id = `conv-${projectId}-${channelType}`;
        const docRef = firestore.collection('project_conversations').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          return doc.data() as ProjectConversation;
        }
        const now = new Date().toISOString();
        const newConv: ProjectConversation = {
          id,
          projectId,
          channelType,
          participantRoles: getChannelParticipantRoles(channelType),
          createdAt: now,
          updatedAt: now,
        };
        await docRef.set(newConv);
        return newConv;
      } catch (e) {
        console.warn('[HybridDirectLineRepository] Firestore getOrCreateConversation failed, fallback to file:', e);
      }
    }

    const conversations = this.readConversations();
    let conv = conversations.find(c => c.projectId === projectId && c.channelType === channelType);
    if (!conv) {
      const now = new Date().toISOString();
      conv = {
        id: `conv-${projectId}-${channelType}`,
        projectId,
        channelType,
        participantRoles: getChannelParticipantRoles(channelType),
        createdAt: now,
        updatedAt: now,
      };
      conversations.push(conv);
      this.writeConversations(conversations);
    }
    return conv;
  }

  async getConversationsByProject(projectId: string): Promise<ProjectConversation[]> {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const snap = await firestore.collection('project_conversations')
          .where('projectId', '==', projectId)
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data() as ProjectConversation);
        }
      } catch (e) {
        console.warn('[HybridDirectLineRepository] Firestore getConversationsByProject failed, fallback to file:', e);
      }
    }

    const conversations = this.readConversations();
    return conversations.filter(c => c.projectId === projectId);
  }

  async getConversationById(id: string): Promise<ProjectConversation | null> {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const doc = await firestore.collection('project_conversations').doc(id).get();
        if (doc.exists) {
          return doc.data() as ProjectConversation;
        }
      } catch (e) {
        console.warn('[HybridDirectLineRepository] Firestore getConversationById failed, fallback to file:', e);
      }
    }

    const conversations = this.readConversations();
    return conversations.find(c => c.id === id) || null;
  }

  async addMessage(data: {
    projectId: string;
    channelType: ChannelType;
    senderUserId: string;
    senderRole: ProjectRole;
    senderName: string;
    messageType: DirectLineMessageType;
    subject?: string;
    content: string;
    relatedEntityId?: string;
  }): Promise<ProjectMessage> {
    const conv = await this.getOrCreateConversation(data.projectId, data.channelType);
    const now = new Date().toISOString();
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const message: ProjectMessage = {
      id,
      conversationId: conv.id,
      projectId: data.projectId,
      channelType: data.channelType,
      senderUserId: data.senderUserId,
      senderRole: data.senderRole,
      senderName: data.senderName,
      messageType: data.messageType,
      subject: data.subject,
      content: data.content,
      relatedEntityId: data.relatedEntityId,
      createdAt: now,
    };

    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await firestore.collection('project_messages').doc(id).set(message);
        await firestore.collection('project_conversations').doc(conv.id).update({
          updatedAt: now,
          lastMessageSnippet: data.content.substring(0, 100),
          lastMessageAt: now,
        });
        return message;
      } catch (e) {
        console.warn('[HybridDirectLineRepository] Firestore addMessage failed, fallback to file:', e);
      }
    }

    const messages = this.readMessages();
    messages.push(message);
    this.writeMessages(messages);

    const conversations = this.readConversations();
    const cIdx = conversations.findIndex(c => c.id === conv.id);
    if (cIdx !== -1) {
      conversations[cIdx].updatedAt = now;
      conversations[cIdx].lastMessageSnippet = data.content.substring(0, 100);
      conversations[cIdx].lastMessageAt = now;
      this.writeConversations(conversations);
    }

    return message;
  }

  async getMessagesByChannel(projectId: string, channelType: ChannelType): Promise<ProjectMessage[]> {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const snap = await firestore.collection('project_messages')
          .where('projectId', '==', projectId)
          .where('channelType', '==', channelType)
          .orderBy('createdAt', 'asc')
          .get();
        if (!snap.empty) {
          return snap.docs.map(d => d.data() as ProjectMessage);
        }
      } catch (e) {
        console.warn('[HybridDirectLineRepository] Firestore getMessagesByChannel failed, fallback to file:', e);
      }
    }

    const messages = this.readMessages();
    return messages
      .filter(m => m.projectId === projectId && m.channelType === channelType)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

class DelegatingDirectLineRepository implements IDirectLineRepository {
  private hybrid = new HybridDirectLineRepository();
  private postgres: PostgresDirectLineRepository | null = null;

  private getDelegate(): IDirectLineRepository {
    if (getPersistenceMode() === 'database') {
      if (!this.postgres) {
        this.postgres = new PostgresDirectLineRepository();
      }
      return this.postgres;
    }
    return this.hybrid;
  }

  getOrCreateConversation(projectId: string, channelType: ChannelType): Promise<ProjectConversation> {
    return this.getDelegate().getOrCreateConversation(projectId, channelType);
  }
  getConversationsByProject(projectId: string): Promise<ProjectConversation[]> {
    return this.getDelegate().getConversationsByProject(projectId);
  }
  getConversationById(id: string): Promise<ProjectConversation | null> {
    return this.getDelegate().getConversationById(id);
  }
  addMessage(data: {
    projectId: string;
    channelType: ChannelType;
    senderUserId: string;
    senderRole: ProjectRole;
    senderName: string;
    messageType: DirectLineMessageType;
    subject?: string;
    content: string;
    relatedEntityId?: string;
  }): Promise<ProjectMessage> {
    return this.getDelegate().addMessage(data);
  }
  getMessagesByChannel(projectId: string, channelType: ChannelType): Promise<ProjectMessage[]> {
    return this.getDelegate().getMessagesByChannel(projectId, channelType);
  }
}

export const directLineRepository = new DelegatingDirectLineRepository();
