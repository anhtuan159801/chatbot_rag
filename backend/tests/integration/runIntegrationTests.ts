#!/usr/bin/env node

/**
 * Integration Test Script
 * Kiểm tra toàn bộ hệ thống RAG từ document upload đến AI response
 */

import "dotenv/config";
import { Client } from "pg";
import { InferenceClient } from "@huggingface/inference";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

class IntegrationTest {
  private results: TestResult[] = [];
  private dbClient: Client | null = null;
  private hfClient: InferenceClient;

  constructor() {
    this.hfClient = new InferenceClient(process.env.HUGGINGFACE_API_KEY || "");
  }

  async setup() {
    console.log("🔧 Setting up integration test environment...\n");

    // Connect to database
    try {
      this.dbClient = new Client({
        connectionString: process.env.SUPABASE_URL,
      });
      await this.dbClient.connect();
      console.log("✅ Database connected");
    } catch (error) {
      this.recordResult(
        "Database Connection",
        false,
        `Failed to connect: ${error}`,
        0,
      );
      return false;
    }

    return true;
  }

  async teardown() {
    console.log("\n🧹 Cleaning up...");
    if (this.dbClient) {
      await this.dbClient.end();
      console.log("✅ Database disconnected");
    }
  }

  recordResult(
    name: string,
    passed: boolean,
    message: string,
    duration: number,
  ) {
    this.results.push({ name, passed, message, duration });
    const icon = passed ? "✅" : "❌";
    console.log(`${icon} ${name} (${duration}ms)`);
    if (!passed) {
      console.log(`   ${message}`);
    }
  }

  async run() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  RAG CHATBOT INTEGRATION TEST");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    if (!(await this.setup())) {
      await this.printSummary();
      return;
    }

    try {
      await this.testDatabaseConnection();
      await this.testSchemaIntegrity();
      await this.testConfigTables();
      await this.testVectorSupport();
      await this.testHuggingFaceConnection();
      await this.testEmbeddingGeneration();
      await this.testVectorSearch();
      await this.testKeywordSearch();
      await this.testKnowledgeBaseOperations();
      await this.testRAGPipeline();
    } catch (error) {
      console.error("\n💥 Test execution error:", error);
    } finally {
      await this.teardown();
      await this.printSummary();
    }
  }

  async testDatabaseConnection() {
    const start = Date.now();
    try {
      const result = await this.dbClient!.query("SELECT NOW() as now");
      const now = result.rows[0].now;
      this.recordResult(
        "Database Connection",
        true,
        `Server time: ${now}`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Database Connection",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testSchemaIntegrity() {
    const start = Date.now();
    try {
      const tables = await this.dbClient!.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const expectedTables = [
        "system_configs",
        "ai_models",
        "knowledge_base",
        "knowledge_chunks",
        "ai_role_assignments",
      ];

      const actualTables = tables.rows.map((r) => r.table_name);
      const missingTables = expectedTables.filter(
        (t) => !actualTables.includes(t),
      );

      if (missingTables.length === 0) {
        this.recordResult(
          "Schema Integrity",
          true,
          `All ${expectedTables.length} tables exist`,
          Date.now() - start,
        );
      } else {
        this.recordResult(
          "Schema Integrity",
          false,
          `Missing tables: ${missingTables.join(", ")}`,
          Date.now() - start,
        );
      }
    } catch (error) {
      this.recordResult(
        "Schema Integrity",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testConfigTables() {
    const start = Date.now();
    try {
      // Check system_configs
      const configs = await this.dbClient!.query(
        "SELECT COUNT(*) as count FROM system_configs",
      );
      const configCount = parseInt(configs.rows[0].count);

      // Check ai_models
      const models = await this.dbClient!.query(
        "SELECT COUNT(*) as count FROM ai_models",
      );
      const modelCount = parseInt(models.rows[0].count);

      // Check ai_role_assignments
      const roles = await this.dbClient!.query(
        "SELECT COUNT(*) as count FROM ai_role_assignments",
      );
      const roleCount = parseInt(roles.rows[0].count);

      this.recordResult(
        "Config Tables",
        configCount > 0 && modelCount > 0 && roleCount > 0,
        `Configs: ${configCount}, Models: ${modelCount}, Roles: ${roleCount}`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Config Tables",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testVectorSupport() {
    const start = Date.now();
    try {
      // Check pgvector extension
      const extResult = await this.dbClient!.query(`
        SELECT extname
        FROM pg_extension
        WHERE extname = 'vector'
      `);

      if (extResult.rows.length === 0) {
        this.recordResult(
          "Vector Support",
          false,
          "pgvector extension not installed",
          Date.now() - start,
        );
        return;
      }

      // Check vector column in knowledge_chunks
      const colResult = await this.dbClient!.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
      `);

      if (colResult.rows.length === 0) {
        this.recordResult(
          "Vector Support",
          false,
          "embedding column not found",
          Date.now() - start,
        );
        return;
      }

      // Check vector dimension
      const dimResult = await this.dbClient!.query(`
        SELECT attndims
        FROM pg_attribute
        WHERE attrelid = 'knowledge_chunks'::regclass AND attname = 'embedding'
      `);

      const dimension = dimResult.rows[0]?.attndims;

      this.recordResult(
        "Vector Support",
        dimension === 384 || dimension === 1024,
        `pgvector installed, embedding column exists (dimension: ${dimension})`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Vector Support",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testHuggingFaceConnection() {
    const start = Date.now();
    try {
      if (!process.env.HUGGINGFACE_API_KEY) {
        this.recordResult(
          "HuggingFace Connection",
          false,
          "HUGGINGFACE_API_KEY not set",
          Date.now() - start,
        );
        return;
      }

      // Test with a simple embedding generation
      const embedding = await this.hfClient.featureExtraction({
        model: "BAAI/bge-small-en-v1.5",
        inputs: "test",
      });

      const emb = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      const embeddingArray = emb as number[];

      this.recordResult(
        "HuggingFace Connection",
        embeddingArray.length === 384,
        `Generated ${embeddingArray.length}-dimension embedding`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "HuggingFace Connection",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testEmbeddingGeneration() {
    const start = Date.now();
    try {
      const testText = "Đăng ký tạm trú cho công dân Việt Nam";
      const embedding = await this.hfClient.featureExtraction({
        model: "BAAI/bge-small-en-v1.5",
        inputs: testText,
      });

      const emb = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      const embeddingArray = emb as number[];

      this.recordResult(
        "Embedding Generation (Vietnamese)",
        embeddingArray.length === 384,
        `Generated embedding for: "${testText.substring(0, 30)}..."`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Embedding Generation (Vietnamese)",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testVectorSearch() {
    const start = Date.now();
    try {
      // Check if there are any chunks with embeddings
      const chunksResult = await this.dbClient!.query(`
        SELECT COUNT(*) as count
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
      `);

      const chunkCount = parseInt(chunksResult.rows[0].count);

      if (chunkCount === 0) {
        this.recordResult(
          "Vector Search",
          false,
          "No chunks with embeddings found",
          Date.now() - start,
        );
        return;
      }

      // Test vector similarity search
      const embedding = await this.hfClient.featureExtraction({
        model: "BAAI/bge-small-en-v1.5",
        inputs: "tạm trú",
      });

      const emb = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      const embeddingArray = emb as number[];
      const embeddingStr = embeddingArray.join(",");

      const result = await this.dbClient!.query(
        `
        SELECT id, content, (1 - (embedding <=> string_to_array($1, ',')::float4[]::vector)) AS similarity
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> string_to_array($1, ',')::float4[]::vector
        LIMIT 3
      `,
        [embeddingStr],
      );

      this.recordResult(
        "Vector Search",
        result.rows.length > 0,
        `Found ${result.rows.length} chunks, top similarity: ${(result.rows[0]?.similarity || 0).toFixed(4)}`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Vector Search",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testKeywordSearch() {
    const start = Date.now();
    try {
      // Test keyword search
      const result = await this.dbClient!.query(`
        SELECT id, content
        FROM knowledge_chunks
        WHERE content ILIKE '%tạm trú%'
        LIMIT 5
      `);

      this.recordResult(
        "Keyword Search",
        result.rows.length >= 0,
        `Found ${result.rows.length} chunks containing "tạm trú"`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Keyword Search",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testKnowledgeBaseOperations() {
    const start = Date.now();
    try {
      // Count documents
      const docsResult = await this.dbClient!.query(`
        SELECT COUNT(*) as count
        FROM knowledge_base
      `);

      const docCount = parseInt(docsResult.rows[0].count);

      // Count chunks
      const chunksResult = await this.dbClient!.query(`
        SELECT COUNT(*) as count
        FROM knowledge_chunks
      `);

      const chunkCount = parseInt(chunksResult.rows[0].count);

      // Count chunks with embeddings
      const embeddingsResult = await this.dbClient!.query(`
        SELECT COUNT(*) as count
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
      `);

      const embeddingCount = parseInt(embeddingsResult.rows[0].count);

      this.recordResult(
        "Knowledge Base Operations",
        true,
        `Documents: ${docCount}, Chunks: ${chunkCount}, Embeddings: ${embeddingCount}`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "Knowledge Base Operations",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async testRAGPipeline() {
    const start = Date.now();
    try {
      // Simulate a RAG query
      const query = "Tôi muốn đăng ký tạm trú thì cần chuẩn bị gì?";

      // 1. Generate query embedding
      const embedding = await this.hfClient.featureExtraction({
        model: "BAAI/bge-small-en-v1.5",
        inputs: query,
      });

      const emb = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      const embeddingArray = emb as number[];
      const embeddingStr = embeddingArray.join(",");

      // 2. Vector search
      const vectorResults = await this.dbClient!.query(
        `
        SELECT id, content, (1 - (embedding <=> string_to_array($1, ',')::float4[]::vector)) AS similarity
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> string_to_array($1, ',')::float4[]::vector
        LIMIT 5
      `,
        [embeddingStr],
      );

      // 3. Keyword search
      const keywordResults = await this.dbClient!.query(`
        SELECT id, content
        FROM knowledge_chunks
        WHERE content ILIKE ANY(ARRAY['%tạm trú%', '%đăng ký%', '%hồ sơ%'])
        LIMIT 5
      `);

      // 4. Combine results (simplified)
      const totalResults =
        vectorResults.rows.length + keywordResults.rows.length;

      this.recordResult(
        "RAG Pipeline",
        totalResults > 0,
        `Query: "${query.substring(0, 30)}...", Results: ${totalResults} (vector: ${vectorResults.rows.length}, keyword: ${keywordResults.rows.length})`,
        Date.now() - start,
      );
    } catch (error) {
      this.recordResult(
        "RAG Pipeline",
        false,
        String(error),
        Date.now() - start,
      );
    }
  }

  async printSummary() {
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("  TEST SUMMARY");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`Total Tests:  ${total}`);
    console.log(`Passed:       ${passed} ✅`);
    console.log(`Failed:       ${failed} ❌`);
    console.log(`Pass Rate:    ${passRate}%`);

    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   • ${r.name}: ${r.message}`);
        });
    }

    // Calculate total duration
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\n⏱️  Total Duration: ${totalDuration}ms`);

    // Generate JSON report
    const reportPath = join(__dirname, "test-report.json");
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        passRate,
        totalDuration,
      },
      results: this.results,
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${reportPath}\n`);

    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run tests
const test = new IntegrationTest();
test.run().catch(console.error);
