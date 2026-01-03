import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { chunkingService } from "../../services/chunkingService";

describe("ChunkingService", () => {
  const vietnameseAdministrativeText = `
THỦ TỤC ĐĂNG KÝ TẠM TRÚ

Căn thực hiện theo Luật Cư trú 2020.

1. Đối tượng áp dụng:
Công dân Việt Nam đến sinh sống, làm việc tại địa phương khác nơi thường trú từ 30 ngày trở lên.

2. Hồ sơ cần chuẩn bị:
- Tờ khai đăng ký tạm trú
- Giấy tờ tùy thân (CCCD/CMND)
- Giấy tờ chứng minh nơi ở hợp pháp (hợp đồng thuê nhà, xác nhận của chủ nhà, v.v.)

3. Thời gian giải quyết:
Trong vòng 02 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ.

4. Lệ phí: Miễn lệ phí đăng ký tạm trú.

5. Cơ quan thực hiện: Công an cấp xã/phường nơi người đến tạm trú.
`;

  const longText = vietnameseAdministrativeText.repeat(5);

  describe("paragraph strategy", () => {
    it("nên chia nhỏ text thành các đoạn văn bản", () => {
      const chunks = chunkingService.chunk(vietnameseAdministrativeText, {
        strategy: "paragraph",
        maxChunkSize: 2000,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain("THỦ TỤC ĐĂNG KÝ TẠM TRÚ");
      expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
    });

    it("nên tôn trọng giới hạn maxChunkSize", () => {
      const chunks = chunkingService.chunk(longText, {
        strategy: "paragraph",
        maxChunkSize: 500,
      });

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(500 + 100); // Allow small overflow
      });
    });

    it("nên có metadata đúng với chunk index", () => {
      const chunks = chunkingService.chunk(vietnameseAdministrativeText, {
        strategy: "paragraph",
      });

      chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index);
      });
    });
  });

  describe("fixed strategy", () => {
    it("nên chia nhỏ text thành các chunks kích thước cố định", () => {
      const chunks = chunkingService.chunk(vietnameseAdministrativeText, {
        strategy: "fixed",
        chunkSize: 200,
        chunkOverlap: 50,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(200 + 50); // Allow overlap
      });
    });

    it("nên có overlap giữa các chunks", () => {
      const chunks = chunkingService.chunk(longText, {
        strategy: "fixed",
        chunkSize: 300,
        chunkOverlap: 100,
      });

      if (chunks.length > 1) {
        const chunk1End = chunks[0].text.slice(-100);
        const chunk2Start = chunks[1].text.slice(0, 100);
        const hasOverlap =
          chunk1End.includes(chunk2Start) || chunk2Start.includes(chunk1End);
        expect(hasOverlap).toBe(true);
      }
    });
  });

  describe("sentence strategy", () => {
    it("nên chia nhỏ text thành các câu", () => {
      const text =
        "Đây là câu đầu tiên. Đây là câu thứ hai. Đây là câu thứ ba.";
      const chunks = chunkingService.chunk(text, {
        strategy: "sentence",
        maxChunkSize: 100,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain("câu");
    });

    it("nên giữ nguyên cấu trúc câu", () => {
      const chunks = chunkingService.chunk(vietnameseAdministrativeText, {
        strategy: "sentence",
        maxChunkSize: 500,
      });

      chunks.forEach((chunk) => {
        const sentences = chunk.text.split(/[.!?]+/);
        sentences.forEach((sentence) => {
          expect(sentence.trim()).toBeTruthy();
        });
      });
    });
  });

  describe("addMetadata", () => {
    it("nên thêm metadata vào tất cả chunks", () => {
      const chunks = chunkingService.chunk(vietnameseAdministrativeText, {
        strategy: "paragraph",
      });

      const metadata = {
        source: "test_document.pdf",
        type: "DOCUMENT",
        totalPages: 1,
      };

      const chunksWithMetadata = chunkingService.addMetadata(chunks, metadata);

      chunksWithMetadata.forEach((chunk) => {
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.source).toBe("test_document.pdf");
        expect(chunk.metadata.type).toBe("DOCUMENT");
        expect(chunk.metadata.totalPages).toBe(1);
      });
    });

    it("nên giữ lại metadata cũ khi thêm mới", () => {
      const chunks = chunkingService.chunk(vietnameseAdministrativeText, {
        strategy: "paragraph",
      });

      const oldMetadata = { oldKey: "oldValue" };
      const newMetadata = { newKey: "newValue" };

      const chunksWithOldMetadata = chunkingService.addMetadata(
        chunks,
        oldMetadata,
      );
      const chunksWithNewMetadata = chunkingService.addMetadata(
        chunksWithOldMetadata,
        newMetadata,
      );

      chunksWithNewMetadata.forEach((chunk) => {
        expect(chunk.metadata.oldKey).toBe("oldValue");
        expect(chunk.metadata.newKey).toBe("newValue");
      });
    });
  });

  describe("edge cases", () => {
    it("nên xử lý text rỗng", () => {
      const chunks = chunkingService.chunk("", {
        strategy: "paragraph",
      });

      expect(chunks.length).toBe(0);
    });

    it("nên xử lý text chỉ có whitespace", () => {
      const chunks = chunkingService.chunk("   \n\n   \t   ", {
        strategy: "paragraph",
      });

      expect(chunks.length).toBe(0);
    });

    it("nên xử lý text ngắn hơn chunkSize", () => {
      const chunks = chunkingService.chunk("Ngắn thôi.", {
        strategy: "fixed",
        chunkSize: 1000,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toContain("Ngắn thôi.");
    });

    it("nên xử lý Vietnamese text có dấu", () => {
      const text =
        "Xin chào, tôi là người Việt Nam. Thủ tục hành chính công cần thiết.";
      const chunks = chunkingService.chunk(text, {
        strategy: "paragraph",
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain("Việt Nam");
      expect(chunks[0].text).toContain("hành chính");
    });
  });
});
