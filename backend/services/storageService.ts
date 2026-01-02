import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StoredFile {
  path: string;
  url: string;
  size: number;
}

export class StorageService {
  private uploadsDir: string;
  private useSupabaseStorage: boolean;
  private supabase: any = null;
  private bucketName: string = "knowledge-files";

  constructor() {
    this.uploadsDir = path.join(__dirname, "..", "uploads");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    this.useSupabaseStorage = this.isValidSupabaseConfig(
      supabaseUrl,
      supabaseKey,
    );

    if (this.useSupabaseStorage) {
      try {
        this.supabase = createClient(
          supabaseUrl as string,
          supabaseKey as string,
        );
        console.log("StorageService initialized with Supabase Storage");
      } catch (error) {
        console.warn(
          "Failed to initialize Supabase Storage client, falling back to local storage:",
          error,
        );
        this.useSupabaseStorage = false;
        this.ensureUploadsDirectory();
        console.log(
          "StorageService initialized with local storage:",
          this.uploadsDir,
        );
      }
    } else {
      this.ensureUploadsDirectory();
      console.log(
        "StorageService initialized with local storage:",
        this.uploadsDir,
      );
    }
  }

  private isValidSupabaseConfig(url?: string, key?: string): boolean {
    if (!url || !key) {
      return false;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl.match(/^https?:\/\//i)) {
      console.warn(
        "Invalid SUPABASE_URL format, falling back to local storage",
      );
      return false;
    }
    return true;
  }

  private ensureUploadsDirectory() {
    fs.ensureDirSync(this.uploadsDir);
  }

  async saveFile(
    file: Express.Multer.File,
    documentId: string,
  ): Promise<StoredFile> {
    const ext = path.extname(file.originalname);
    const filename = `${documentId}${ext}`;

    if (this.useSupabaseStorage && this.supabase) {
      try {
        return await this.saveToSupabase(file, filename);
      } catch (error: any) {
        console.warn(
          `Supabase Storage failed (${error.message}), falling back to local storage`,
        );
        this.useSupabaseStorage = false;
        return this.saveToLocal(file, filename);
      }
    } else {
      return this.saveToLocal(file, filename);
    }
  }

  private async saveToSupabase(
    file: Express.Multer.File,
    filename: string,
  ): Promise<StoredFile> {
    try {
      if (!this.supabase) {
        throw new Error("Supabase client not initialized");
      }

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        console.error("Supabase Storage upload error:", error);
        throw error;
      }

      if (!data) {
        throw new Error("No data returned from Supabase Storage");
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filename);

      return {
        path: filename,
        url: publicUrlData.publicUrl,
        size: file.size,
      };
    } catch (error: any) {
      console.error("Error saving to Supabase Storage:", error.message);
      throw error;
    }
  }

  private async saveToLocal(
    file: Express.Multer.File,
    filename: string,
  ): Promise<StoredFile> {
    try {
      const filePath = path.join(this.uploadsDir, filename);
      await fs.writeFile(filePath, file.buffer);

      const baseUrl = process.env.BASE_URL || "http://localhost:8080";

      return {
        path: filePath,
        url: `${baseUrl}/uploads/${filename}`,
        size: file.size,
      };
    } catch (error: any) {
      console.error("Error saving to local storage:", error.message);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (this.useSupabaseStorage && this.supabase) {
      try {
        await this.deleteFromSupabase(filePath);
      } catch (error) {
        console.warn(
          "Failed to delete from Supabase, trying local deletion:",
          error,
        );
        await this.deleteFromLocal(filePath);
      }
    } else {
      await this.deleteFromLocal(filePath);
    }
  }

  private async deleteFromSupabase(filePath: string): Promise<void> {
    try {
      if (!this.supabase) {
        throw new Error("Supabase client not initialized");
      }

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error("Supabase Storage delete error:", error);
        throw error;
      }
    } catch (error: any) {
      console.error("Error deleting from Supabase Storage:", error.message);
      throw error;
    }
  }

  private async deleteFromLocal(filePath: string): Promise<void> {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error: any) {
      console.error("Error deleting from local storage:", error.message);
    }
  }

  async getLocalFilePath(filePath: string): Promise<string> {
    if (this.useSupabaseStorage && this.supabase) {
      try {
        if (!this.supabase) {
          throw new Error("Supabase client not initialized");
        }

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .download(filePath);

        if (error) {
          console.warn(
            "Failed to download from Supabase Storage:",
            error.message,
          );
          throw error;
        }

        if (!data) {
          throw new Error("No data returned from Supabase Storage download");
        }

        const tempPath = path.join(this.uploadsDir, path.basename(filePath));
        await fs.writeFile(tempPath, data);
        return tempPath;
      } catch (error: any) {
        console.warn("Falling back to local file path:", error.message);
        return filePath;
      }
    } else {
      return filePath;
    }
  }

  async getFileContent(filePath: string): Promise<Buffer | null> {
    try {
      if (this.useSupabaseStorage && this.supabase) {
        if (!this.supabase) {
          throw new Error("Supabase client not initialized");
        }

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .download(filePath);

        if (error) {
          console.error(
            "Error downloading from Supabase Storage:",
            error.message,
          );
          return null;
        }

        return data;
      } else {
        if (await fs.pathExists(filePath)) {
          return await fs.readFile(filePath);
        }
        return null;
      }
    } catch (error: any) {
      console.error("Error getting file content:", error.message);
      return null;
    }
  }

  getUploadsDirectory(): string {
    return this.uploadsDir;
  }

  isUsingLocalStorage(): boolean {
    return !this.useSupabaseStorage;
  }
}

export const storageService = new StorageService();
