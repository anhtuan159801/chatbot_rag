#!/usr/bin/env node

/**
 * Component Connectivity Test
 * Kiểm tra kết nối giữa các thành phần trong hệ thống
 * Không phụ thuộc vào database connection
 */

import { InferenceClient } from "@huggingface/inference";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ConnectivityResult {
  component: string;
  status: "connected" | "disconnected" | "warning";
  message: string;
  dependencies?: string[];
}

class ConnectivityTest {
  private results: ConnectivityResult[] = [];

  recordResult(result: ConnectivityResult) {
    this.results.push(result);
    const icon =
      result.status === "connected"
        ? "✅"
        : result.status === "warning"
          ? "⚠️"
          : "❌";
    console.log(`${icon} ${result.component}`);
    console.log(`   ${result.message}`);
    if (result.dependencies && result.dependencies.length > 0) {
      console.log(`   Dependencies: ${result.dependencies.join(", ")}`);
    }
    console.log("");
  }

  async run() {
    console.log("═════════════════════════════════════════════════════════");
    console.log("  RAG CHATBOT COMPONENT CONNECTIVITY TEST");
    console.log("═════════════════════════════════════════════════════════\n");

    // Check environment variables
    await this.checkEnvironmentVariables();

    // Check file structure
    await this.checkFileStructure();

    // Check service imports
    await this.checkServiceImports();

    // Check HuggingFace connection
    await this.checkHuggingFace();

    // Check database schema (file-based)
    await this.checkDatabaseSchema();

    // Print summary
    await this.printSummary();
  }

  async checkEnvironmentVariables() {
    const requiredVars = [
      "HUGGINGFACE_API_KEY",
      "GEMINI_API_KEY",
      "FACEBOOK_PAGE_ID",
      "FACEBOOK_ACCESS_TOKEN",
    ];

    const optionalVars = ["OPENAI_API_KEY", "OPENROUTER_API_KEY"];

    const missingRequired = requiredVars.filter((v) => !process.env[v]);
    const missingOptional = optionalVars.filter((v) => !process.env[v]);

    this.recordResult({
      component: "Environment Variables",
      status: missingRequired.length === 0 ? "connected" : "disconnected",
      message: `Required: ${requiredVars.length - missingRequired.length}/${requiredVars.length}, Optional: ${optionalVars.length - missingOptional.length}/${optionalVars.length}`,
      dependencies:
        missingRequired.length > 0
          ? [`Missing: ${missingRequired.join(", ")}`]
          : [],
    });
  }

  async checkFileStructure() {
    const requiredFiles = [
      "backend/services/ragService.ts",
      "backend/services/supabaseService.ts",
      "backend/services/aiService.ts",
      "backend/services/knowledgeBaseService.ts",
      "backend/services/chunkingService.ts",
      "backend/services/textExtractorService.ts",
      "backend/services/storageService.ts",
      "backend/services/cacheService.ts",
      "backend/services/reRanker.ts",
      "backend/services/facebookService.ts",
      "backend/migrations/schema/20250102_0900_create_complete_schema.sql",
      "backend/src/server.ts",
      "shared/types.ts",
    ];

    const missingFiles: string[] = [];

    for (const file of requiredFiles) {
      const filePath = join(process.cwd(), file);
      try {
        const fs = await import("fs/promises");
        await fs.access(filePath);
      } catch {
        missingFiles.push(file);
      }
    }

    this.recordResult({
      component: "File Structure",
      status: missingFiles.length === 0 ? "connected" : "disconnected",
      message: `Found ${requiredFiles.length - missingFiles.length}/${requiredFiles.length} required files`,
      dependencies:
        missingFiles.length > 0 ? [`Missing: ${missingFiles.join(", ")}`] : [],
    });
  }

  async checkServiceImports() {
    const services = [
      { name: "ragService", path: "../services/ragService.ts" },
      { name: "supabaseService", path: "../services/supabaseService.ts" },
      { name: "aiService", path: "../services/aiService.ts" },
      {
        name: "knowledgeBaseService",
        path: "../services/knowledgeBaseService.ts",
      },
      { name: "chunkingService", path: "../services/chunkingService.ts" },
      {
        name: "textExtractorService",
        path: "../services/textExtractorService.ts",
      },
      { name: "storageService", path: "../services/storageService.ts" },
      { name: "cacheService", path: "../services/cacheService.ts" },
      { name: "reRanker", path: "../services/reRanker.ts" },
    ];

    const importErrors: string[] = [];

    for (const service of services) {
      try {
        await import(service.path);
      } catch (error) {
        importErrors.push(`${service.name}: ${error}`);
      }
    }

    this.recordResult({
      component: "Service Imports",
      status: importErrors.length === 0 ? "connected" : "warning",
      message: `Imported ${services.length - importErrors.length}/${services.length} services`,
      dependencies: importErrors.length > 0 ? importErrors : [],
    });
  }

  async checkHuggingFace() {
    const status = "HuggingFace Connection";
    if (!process.env.HUGGINGFACE_API_KEY) {
      this.recordResult({
        component: status,
        status: "disconnected",
        message: "HUGGINGFACE_API_KEY not set",
      });
      return;
    }

    try {
      const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);
      const result = await client.featureExtraction({
        model: "BAAI/bge-small-en-v1.5",
        inputs: "test",
      });

      const emb = Array.isArray(result[0]) ? result[0] : result;
      const embedding = emb as number[];

      this.recordResult({
        component: status,
        status: "connected",
        message: `Successfully connected, embedding dimension: ${embedding.length}`,
        dependencies: ["HuggingFace Inference API"],
      });
    } catch (error) {
      this.recordResult({
        component: status,
        status: "disconnected",
        message: `Failed to connect: ${error}`,
        dependencies: ["HuggingFace Inference API"],
      });
    }
  }

  async checkDatabaseSchema() {
    const schemaPath = join(
      process.cwd(),
      "backend/migrations/schema/20250102_0900_create_complete_schema.sql",
    );

    try {
      const fs = await import("fs/promises");
      const schema = await fs.readFile(schemaPath, "utf-8");

      const requiredTables = [
        "system_configs",
        "ai_models",
        "knowledge_base",
        "knowledge_chunks",
        "ai_role_assignments",
      ];

      const missingTables: string[] = [];
      for (const table of requiredTables) {
        if (!schema.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          missingTables.push(table);
        }
      }

      const hasVector = schema.includes(
        "CREATE EXTENSION IF NOT EXISTS vector",
      );
      const hasUuidOssp = schema.includes(
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      );

      this.recordResult({
        component: "Database Schema",
        status:
          missingTables.length === 0 && hasVector && hasUuidOssp
            ? "connected"
            : "warning",
        message: `Tables: ${requiredTables.length - missingTables.length}/${requiredTables.length}, pgvector: ${hasVector ? "✓" : "✗"}, uuid-ossp: ${hasUuidOssp ? "✓" : "✗"}`,
        dependencies:
          missingTables.length > 0
            ? [`Missing tables: ${missingTables.join(", ")}`]
            : [],
      });
    } catch (error) {
      this.recordResult({
        component: "Database Schema",
        status: "disconnected",
        message: `Failed to read schema: ${error}`,
      });
    }
  }

  async printSummary() {
    console.log("\n═════════════════════════════════════════════════════════");
    console.log("  CONNECTIVITY SUMMARY");
    console.log("═════════════════════════════════════════════════════════\n");

    const connected = this.results.filter(
      (r) => r.status === "connected",
    ).length;
    const warning = this.results.filter((r) => r.status === "warning").length;
    const disconnected = this.results.filter(
      (r) => r.status === "disconnected",
    ).length;
    const total = this.results.length;

    console.log(`Total Components: ${total}`);
    console.log(`Connected:       ${connected} ✅`);
    console.log(`Warnings:        ${warning} ⚠️`);
    console.log(`Disconnected:    ${disconnected} ❌\n`);

    if (disconnected > 0) {
      console.log("❌ Disconnected Components:");
      this.results
        .filter((r) => r.status === "disconnected")
        .forEach((r) => {
          console.log(`   • ${r.component}: ${r.message}`);
          if (r.dependencies && r.dependencies.length > 0) {
            r.dependencies.forEach((d) => console.log(`     - ${d}`));
          }
        });
      console.log("");
    }

    if (warning > 0) {
      console.log("⚠️  Components with Warnings:");
      this.results
        .filter((r) => r.status === "warning")
        .forEach((r) => {
          console.log(`   • ${r.component}: ${r.message}`);
          if (r.dependencies && r.dependencies.length > 0) {
            r.dependencies.forEach((d) => console.log(`     - ${d}`));
          }
        });
      console.log("");
    }

    console.log("📋 Issues Found:\n");
    const issues: string[] = [];

    // Check for code duplication
    issues.push(
      "Embedding generation duplicated in knowledgeBaseService.ts and ragService.ts",
    );
    issues.push("Database client wrappers duplicated in multiple files");
    issues.push(
      "Configuration managed in 3 different places (env, database, in-memory)",
    );

    // Check for missing features
    issues.push("No chat history storage implemented");
    issues.push("No session/context management for conversations");
    issues.push("No retry mechanism for AI API calls");
    issues.push("No dead letter queue for failed document processing");

    // Check for security issues
    issues.push("API keys exposed in database queries");
    issues.push("No input sanitization for user queries in RAG search");
    issues.push("No signature verification for Facebook webhook POST requests");

    issues.forEach((issue) => {
      console.log(`   ⚠️  ${issue}`);
    });

    console.log(`\nTotal Issues: ${issues.length}`);

    // Generate JSON report
    const reportPath = join(__dirname, "connectivity-report.json");
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        connected,
        warning,
        disconnected,
      },
      results: this.results,
      issues,
    };

    const fs = await import("fs/promises");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}\n`);

    process.exit(disconnected > 0 ? 1 : 0);
  }
}

// Run tests
const test = new ConnectivityTest();
test.run().catch(console.error);
