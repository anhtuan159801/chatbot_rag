export interface ChatRequest {
  question: string;
  sessionId?: string;
  topK?: number;
}

export interface ChatResponse {
  answer: string;
  sources: Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
  metadata: {
    model: string;
    latency: number;
    chunksRetrieved: number;
  };
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  memory?: Record<string, any>;
  config?: Record<string, any>;
  services?: {
    database?: boolean;
    ai?: boolean;
    vector?: boolean;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  timestamp: string;
}
