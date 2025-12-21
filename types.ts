export enum SystemStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  MAINTENANCE = 'MAINTENANCE'
}

export enum DocumentType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  WEB_CRAWL = 'WEB_CRAWL',
  CSV = 'CSV'
}

export enum IngestionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  VECTORIZING = 'VECTORIZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: DocumentType;
  status: IngestionStatus;
  uploadDate: string;
  vectorCount: number;
  size: string;
}

export interface ChatSession {
  id: string;
  userName: string;
  platform: 'Facebook' | 'Web';
  lastMessage: string;
  timestamp: string;
  status: 'Active' | 'Closed';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: string;
  retrievedChunks?: string[]; // Simulation of RAG context
}

export interface SystemMetrics {
  totalVectors: number;
  activeChats: number;
  systemHealth: SystemStatus;
  apiLatencyMs: number;
  dailyRequests: number;
}

export interface Member {
  id: string;
  name: string;
  position: string;
  role: string;
  phone: string;
  email?: string;
  facebookId?: string; // Facebook ID for direct messaging
  department?: string;
  tasks: string[];
  avatar?: string;
}
