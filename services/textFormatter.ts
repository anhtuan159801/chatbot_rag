/**
 * Markdown to Plain Text Converter cho Facebook Messenger
 * Facebook không hỗ trợ markdown, cần convert sang text đơn giản
 */

export function convertMarkdownToText(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // Headers (##, ###, etc.) - Convert sang uppercase
  text = text.replace(/^#{1,6}\s+(.*)$/gm, (match, content) => {
    return `${content.trim()}\n`;
  });

  // Bold (**text** or __text__)
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');

  // Italic (*text* or _text_)
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/_(.*?)_/g, '$1');

  // Strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Code blocks (```code```) - Giữ lại nhưng thêm quote
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```[a-z]*\n?/g, '').replace(/```$/g, '');
    return `📋 Code:\n${code}`;
  });

  // Inline code (`code`) - Giữ lại
  text = text.replace(/`([^`]+)`/g, '$1');

  // Links [text](url) - Convert sang plain text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Images ![alt](url) - Add emoji placeholder
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '🖼️');

  // Unordered lists (- item or * item)
  text = text.replace(/^[\*\-]\s+(.*)$/gm, '• $1');

  // Ordered lists (1. item)
  text = text.replace(/^\d+\.\s+(.*)$/gm, '$1.');

  // Blockquotes (> text)
  text = text.replace(/^>\s+(.*)$/gm, '💬 $1');

  // Horizontal rules (--- or ***)
  text = text.replace(/^[\*\-]{3,}$/gm, '─────────');

  // Multiple blank lines - convert to single line break
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Truncate text nếu quá dài (Facebook có giới hạn ~2000 ký tự)
 */
export function truncateForFacebook(text: string, maxLength: number = 1900): string {
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format message với emoji cho readability tốt hơn
 */
export function enhanceReadability(text: string): string {
  if (!text) return '';

  // Add spacing after sentences
  text = text.replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2');

  // Add bullet points for lists
  text = text.replace(/^(\d+[.)]\s)/gm, '$1 ');

  return text;
}
