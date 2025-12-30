import { KnowledgeChunk, HybridSearchResult } from '../models/database.js';
import { config } from '../config/index.js';

export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function truncateText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function escapeMarkdown(text: string): string {
  return text
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

export function calculateHybridScore(
  vectorScore: number,
  keywordScore: number | undefined
): number {
  return vectorScore * config.rag.vectorWeight + (keywordScore || 0) * config.rag.keywordWeight;
}

export function deduplicateResults(results: HybridSearchResult[]): HybridSearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    if (seen.has(result.id)) return false;
    seen.add(result.id);
    return true;
  });
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
}

export function getEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
