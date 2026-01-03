import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { textExtractorService } from "../../services/textExtractorService";
import * as fs from "fs/promises";
import * as path from "path";

// Mock the external libraries
jest.mock("mammoth", () => ({
  extractRawText: jest.fn(),
}));

jest.mock("pdf-parse", () => jest.fn());

jest.mock("cheerio", () => ({
  load: jest.fn((html: string) => ({
    text: jest.fn(() => html.replace(/<[^>]*>?/gm, "").trim()),
  })),
}));

jest.mock("puppeteer", () => ({
  launch: jest.fn(() => ({
    newPage: jest.fn(() => ({
      goto: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn(),
    })),
    close: jest.fn(),
  })),
}));

describe("TextExtractorService", () => {
  const testDir = path.join(process.cwd(), "backend", "tests", "fixtures");

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("extractFromFile", () => {
    it("nên throw error nếu file không tồn tại", async () => {
      const nonExistentPath = "/path/to/nonexistent/file.pdf";
      await expect(
        textExtractorService.extractFromFile(nonExistentPath),
      ).rejects.toThrow();
    });

    it("nên throw error nếu file extension không hỗ trợ", async () => {
      const testPath = path.join(testDir, "test.unknown");
      await expect(
        textExtractorService.extractFromFile(testPath),
      ).rejects.toThrow("Unsupported file type");
    });

    it("nên extract text từ PDF file", async () => {
      const pdfParse = require("pdf-parse");
      pdfParse.mockResolvedValue({ text: "Nội dung PDF", numpages: 5 });

      const result = await textExtractorService.extractFromFile("test.pdf");
      expect(result.text).toContain("Nội dung PDF");
      expect(result.metadata.totalPages).toBe(5);
      expect(result.metadata.words).toBeGreaterThan(0);
    });

    it("nên extract text từ DOCX file", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockResolvedValue({ value: "Nội dung DOCX" });

      const result = await textExtractorService.extractFromFile("test.docx");
      expect(result.text).toContain("Nội dung DOCX");
      expect(result.metadata.totalPages).toBe(1);
    });

    it("nên extract text từ TXT file", async () => {
      const testPath = path.join(testDir, "test.txt");
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(testPath, "Nội dung TXT file");

      const result = await textExtractorService.extractFromFile(testPath);
      expect(result.text).toContain("Nội dung TXT file");
      expect(result.metadata.totalPages).toBe(1);

      // Cleanup
      await fs.unlink(testPath);
    });

    it("nên extract text từ CSV file", async () => {
      const testPath = path.join(testDir, "test.csv");
      const csvContent = "Name,Age,City\nNguyen,25,Ha Noi\nTran,30,HCM";
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(testPath, csvContent);

      const result = await textExtractorService.extractFromFile(testPath);
      expect(result.text).toContain("Nguyen");
      expect(result.text).toContain("Tran");
      expect(result.metadata.totalPages).toBe(1);

      // Cleanup
      await fs.unlink(testPath);
    });
  });

  describe("extractFromBuffer", () => {
    it("nên throw error nếu buffer rỗng", async () => {
      const emptyBuffer = Buffer.from("");
      await expect(
        textExtractorService.extractFromBuffer(emptyBuffer, "test.pdf"),
      ).rejects.toThrow();
    });

    it("nên extract text từ PDF buffer", async () => {
      const pdfParse = require("pdf-parse");
      pdfParse.mockResolvedValue({
        text: "Nội dung PDF từ buffer",
        numpages: 3,
      });

      const buffer = Buffer.from("fake pdf content");
      const result = await textExtractorService.extractFromBuffer(
        buffer,
        "test.pdf",
      );
      expect(result.text).toContain("Nội dung PDF từ buffer");
      expect(result.metadata.totalPages).toBe(3);
    });

    it("nên extract text từ DOCX buffer", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockResolvedValue({
        value: "Nội dung DOCX từ buffer",
      });

      const buffer = Buffer.from("fake docx content");
      const result = await textExtractorService.extractFromBuffer(
        buffer,
        "test.docx",
      );
      expect(result.text).toContain("Nội dung DOCX từ buffer");
    });
  });

  describe("extractFromWeb", () => {
    it("nên throw error nếu URL không hợp lệ", async () => {
      await expect(
        textExtractorService.extractFromWeb("not-a-url"),
      ).rejects.toThrow();
    });

    it("nên throw error nếu URL không có protocol", async () => {
      await expect(
        textExtractorService.extractFromWeb("example.com"),
      ).rejects.toThrow();
    });

    it("nên extract text từ HTML đơn giản", async () => {
      const result = await textExtractorService.extractFromWeb(
        "http://example.com/simple",
      );
      expect(result.text).toBeDefined();
      expect(result.metadata.words).toBeGreaterThan(0);
    });

    it("nên extract text từ trang web có JavaScript", async () => {
      const result = await textExtractorService.extractFromWeb(
        "http://example.com/with-js",
      );
      expect(result.text).toBeDefined();
    });

    it("nên sanitize HTML tags", async () => {
      const result =
        await textExtractorService.extractFromWeb("http://example.com");
      expect(result.text).not.toContain("<div>");
      expect(result.text).not.toContain("<p>");
      expect(result.text).not.toContain("<script>");
    });
  });

  describe("metadata calculation", () => {
    it("nên tính số lượng words đúng cho Vietnamese text", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockResolvedValue({
        value: "Xin chào, tôi là người Việt Nam. Thủ tục hành chính công.",
      });

      const result = await textExtractorService.extractFromFile("test.docx");
      expect(result.metadata.words).toBeGreaterThan(0);
      // Vietnamese text should count words by splitting on spaces and punctuation
      expect(result.metadata.words).toBeLessThanOrEqual(20);
    });

    it("nên tính số trang cho PDF", async () => {
      const pdfParse = require("pdf-parse");
      pdfParse.mockResolvedValue({ text: "test", numpages: 7 });

      const result = await textExtractorService.extractFromFile("test.pdf");
      expect(result.metadata.totalPages).toBe(7);
    });

    it("nên set totalPages=1 cho non-PDF files", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockResolvedValue({ value: "test content" });

      const result = await textExtractorService.extractFromFile("test.docx");
      expect(result.metadata.totalPages).toBe(1);
    });
  });

  describe("Vietnamese text handling", () => {
    it("nên preserve Vietnamese characters", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockResolvedValue({
        value: "Hướng dẫn đăng ký tạm trú cho công dân Việt Nam.",
      });

      const result = await textExtractorService.extractFromFile("test.docx");
      expect(result.text).toContain("Việt Nam");
      expect(result.text).toContain("đăng ký");
      expect(result.text).toContain("tạm trú");
    });

    it("nên handle Vietnamese punctuation", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockResolvedValue({
        value:
          "Thủ tục bao gồm: 1. Chuẩn bị hồ sơ; 2. Nộp hồ sơ; 3. Nhận kết quả.",
      });

      const result = await textExtractorService.extractFromFile("test.docx");
      expect(result.text).toContain(":");
      expect(result.text).toContain(";");
    });
  });

  describe("error handling", () => {
    it("nên throw error khi PDF parse fails", async () => {
      const pdfParse = require("pdf-parse");
      pdfParse.mockRejectedValue(new Error("PDF parse failed"));

      await expect(
        textExtractorService.extractFromFile("test.pdf"),
      ).rejects.toThrow("PDF parse failed");
    });

    it("nên throw error khi DOCX parse fails", async () => {
      const mammoth = require("mammoth");
      mammoth.extractRawText.mockRejectedValue(new Error("DOCX parse failed"));

      await expect(
        textExtractorService.extractFromFile("test.docx"),
      ).rejects.toThrow("DOCX parse failed");
    });

    it("nên throw error khi web scraping fails", async () => {
      const puppeteer = require("puppeteer");
      puppeteer.launch.mockRejectedValue(new Error("Browser launch failed"));

      await expect(
        textExtractorService.extractFromWeb("http://example.com"),
      ).rejects.toThrow();
    });
  });
});
