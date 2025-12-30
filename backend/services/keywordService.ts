const vietnameseStopWords = new Set([
  'và',
  'hoặc',
  'nhưng',
  'thì',
  'mà',
  'vì',
  'là',
  'của',
  'có',
  'đã',
  'đang',
  'sẽ',
  'không',
  'nên',
  'cần',
  'để',
  'từ',
  'ở',
  'với',
  'cho',
  'đến',
  'như',
  'những',
  'các',
  'này',
  'đó',
  'kia',
  'nào',
  'ai',
  'gì',
  'đâu',
  'làm',
  'đi',
  'lên',
  'xuống',
  'the',
  'is',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'because',
  'as',
  'what',
  'when',
  'where',
  'who',
  'how',
  'this',
  'that',
  'these',
  'those',
  'am',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'to',
  'with',
  'without',
]);

export interface KeywordScore {
  word: string;
  score: number;
}

export class KeywordService {
  constructor() {}

  extractKeywords(text: string, topN: number = 10): KeywordScore[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const words = this.tokenize(text);
    const filteredWords = words.filter(
      word => word.length > 2 && !vietnameseStopWords.has(word.toLowerCase()) && !/^\d+$/.test(word)
    );

    if (filteredWords.length === 0) {
      return [];
    }

    const termFrequency = this.calculateTF(filteredWords);
    const keywords = Object.entries(termFrequency)
      .map(([word, score]) => ({ word, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    return keywords;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ');
  }

  private calculateTF(words: string[]): Record<string, number> {
    const termFreq: Record<string, number> = {};
    const totalWords = words.length;

    for (const word of words) {
      termFreq[word] = (termFreq[word] || 0) + 1;
    }

    const result: Record<string, number> = {};
    for (const [word, count] of Object.entries(termFreq)) {
      result[word] = count / totalWords;
    }

    return result;
  }

  formatKeywordQuery(keywords: KeywordScore[]): string {
    return keywords.map(k => k.word).join(' & ');
  }

  getTopKeywords(keywords: KeywordScore[], count: number = 5): string[] {
    return keywords.slice(0, count).map(k => k.word);
  }
}

export const keywordService = new KeywordService();
