import fs from "fs-extra";
import path from "path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import axios from "axios";

export interface ExtractedText {
  text: string;
  metadata: {
    totalPages?: number;
    paragraphs?: number;
    words?: number;
    characters?: number;
  };
}

export class TextExtractorService {
  async extractFromFile(filePath: string): Promise<ExtractedText> {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath);

    switch (ext) {
      case ".pdf":
        return this.extractFromPDFBuffer(buffer);
      case ".docx":
      case ".doc":
        return this.extractFromDOCXBuffer(buffer);
      case ".csv":
        return this.extractFromCSVBuffer(buffer);
      case ".txt":
        return this.extractFromTXTBuffer(buffer);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  async extractFromBuffer(
    buffer: Buffer,
    originalname: string,
  ): Promise<ExtractedText> {
    const ext = path.extname(originalname).toLowerCase();

    switch (ext) {
      case ".pdf":
        return this.extractFromPDFBuffer(buffer);
      case ".docx":
      case ".doc":
        return this.extractFromDOCXBuffer(buffer);
      case ".csv":
        return this.extractFromCSVBuffer(buffer);
      case ".txt":
        return this.extractFromTXTBuffer(buffer);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  async extractFromPDFBuffer(buffer: Buffer): Promise<ExtractedText> {
    try {
      const pdf = new PDFParse({ data: buffer });
      const textResult = await pdf.getText();

      return {
        text: textResult.text,
        metadata: {
          totalPages: textResult.pages.length,
          characters: textResult.text.length,
          words: this.countWords(textResult.text),
        },
      };
    } catch (error) {
      console.error("Error extracting PDF:", error);
      throw new Error(
        `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async extractFromDOCXBuffer(buffer: Buffer): Promise<ExtractedText> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      if (result.messages.length > 0) {
        console.warn("DOCX extraction warnings:", result.messages);
      }

      return {
        text: result.value,
        metadata: {
          characters: result.value.length,
          words: this.countWords(result.value),
          paragraphs: result.value.split(/\n\n+/).length,
        },
      };
    } catch (error) {
      console.error("Error extracting DOCX:", error);
      throw new Error(
        `Failed to extract text from DOCX: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async extractFromCSVBuffer(buffer: Buffer): Promise<ExtractedText> {
    try {
      const content = buffer.toString("utf-8");
      const lines = content.split("\n").filter((line) => line.trim());

      let text = "";
      lines.forEach((line, index) => {
        const values = line.split(",");
        text += `Row ${index + 1}: ${values.join(" | ")}\n`;
      });

      return {
        text: text,
        metadata: {
          characters: text.length,
          words: this.countWords(text),
          paragraphs: lines.length,
        },
      };
    } catch (error) {
      console.error("Error extracting CSV:", error);
      throw new Error(
        `Failed to extract text from CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async extractFromTXTBuffer(buffer: Buffer): Promise<ExtractedText> {
    try {
      const text = buffer.toString("utf-8");

      return {
        text: text,
        metadata: {
          characters: text.length,
          words: this.countWords(text),
          paragraphs: text.split(/\n\n+/).length,
        },
      };
    } catch (error) {
      console.error("Error extracting TXT:", error);
      throw new Error(
        `Failed to extract text from TXT: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async extractFromWeb(url: string): Promise<ExtractedText> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      $("script, style, nav, footer, aside, iframe, noscript").remove();

      const title = $("title").text().trim();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();

      let fullText = title ? `Tiêu đề: ${title}\n\n` : "";
      fullText += `Nguồn: ${url}\n\n`;
      fullText += bodyText;

      return {
        text: fullText,
        metadata: {
          characters: fullText.length,
          words: this.countWords(fullText),
          paragraphs: bodyText.split(/[.!?]+/).length,
        },
      };
    } catch (error) {
      console.error("Error extracting from web:", error);
      throw new Error(
        `Failed to extract text from web: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}

export const textExtractorService = new TextExtractorService();
