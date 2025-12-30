export interface Chunk {
  id: string;
  text: string;
  index: number;
  metadata?: {
    source?: string;
    type?: string;
    [key: string]: any;
  };
}

export type ChunkingStrategy = 'fixed' | 'paragraph' | 'sentence' | 'overlap';

export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
}

export class ChunkingService {
  
  chunk(text: string, options: ChunkingOptions): Chunk[] {
    const strategy = options.strategy || 'fixed';

    switch (strategy) {
      case 'fixed':
        return this.fixedSizeChunking(text, options.chunkSize || 1000, options.chunkOverlap || 200);
      case 'paragraph':
        return this.paragraphChunking(text, options);
      case 'sentence':
        return this.sentenceChunking(text, options);
      case 'overlap':
        return this.overlapChunking(text, options);
      default:
        return this.fixedSizeChunking(text, 1000, 200);
    }
  }

  private fixedSizeChunking(text: string, chunkSize: number, overlap: number): Chunk[] {
    const chunks: Chunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      const chunkText = text.substring(startIndex, endIndex);

      if (chunkText.trim().length > 0) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          text: chunkText,
          index: chunkIndex
        });
      }

      startIndex += chunkSize - overlap;
      chunkIndex++;

      if (overlap >= chunkSize) {
        break;
      }
    }

    return chunks;
  }

  private paragraphChunking(text: string, options: ChunkingOptions): Chunk[] {
    const chunks: Chunk[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let chunkIndex = 0;
    const maxChunkSize = options.maxChunkSize || 2000;

    paragraphs.forEach((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return;

      if (currentChunk.length + trimmed.length < maxChunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      } else {
        if (currentChunk) {
          chunks.push({
            id: `chunk_${chunkIndex}`,
            text: currentChunk,
            index: chunkIndex
          });
          chunkIndex++;
        }
        currentChunk = trimmed;
      }
    });

    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk,
        index: chunkIndex
      });
    }

    return chunks;
  }

  private sentenceChunking(text: string, options: ChunkingOptions): Chunk[] {
    const chunks: Chunk[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';
    let chunkIndex = 0;
    const maxChunkSize = options.maxChunkSize || 1000;

    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (!trimmed) return;

      if (currentChunk.length + trimmed.length < maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + trimmed;
      } else {
        if (currentChunk) {
          chunks.push({
            id: `chunk_${chunkIndex}`,
            text: currentChunk,
            index: chunkIndex
          });
          chunkIndex++;
        }
        currentChunk = trimmed;
      }
    });

    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk,
        index: chunkIndex
      });
    }

    return chunks;
  }

  private overlapChunking(text: string, options: ChunkingOptions): Chunk[] {
    const chunkSize = options.chunkSize || 500;
    const overlap = options.chunkOverlap || 100;
    return this.fixedSizeChunking(text, chunkSize, overlap);
  }

  addMetadata(chunks: Chunk[], metadata: Record<string, any>): Chunk[] {
    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        ...metadata
      }
    }));
  }
}

export const chunkingService = new ChunkingService();
