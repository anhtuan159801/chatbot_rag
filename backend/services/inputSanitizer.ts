/**
 * inputSanitizer.ts
 * -------------------------------------
 * Input sanitization utilities for security
 * -------------------------------------
 */

export function sanitizeQuery(query: string): string {
  if (!query || typeof query !== "string") {
    return "";
  }

  return query
    .trim()
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control characters
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .substring(0, 10000); // Limit length
}

export function sanitizeDocumentName(name: string): string {
  if (!name || typeof name !== "string") {
    return "untitled";
  }

  return name
    .trim()
    .replace(/[<>:"|?*\x00-\x1F\x7F]/g, "") // Remove invalid filename chars
    .substring(0, 255);
}

export function sanitizeURL(url: string): string {
  if (!url || typeof url !== "string") {
    return "";
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
    return parsed.href;
  } catch {
    return "";
  }
}

export function sanitizeJsonString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

export function validateInput(
  input: string,
  maxLength: number = 10000,
  allowEmpty: boolean = false,
): { valid: boolean; error?: string } {
  if (!input && !allowEmpty) {
    return { valid: false, error: "Input cannot be empty" };
  }

  if (input && input.length > maxLength) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${maxLength} characters`,
    };
  }

  return { valid: true };
}
