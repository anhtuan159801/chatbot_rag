import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

  constructor() {
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.useSupabaseStorage = !!(supabaseUrl && supabaseKey);

    if (this.useSupabaseStorage) {
      this.supabase = createClient(
        supabaseUrl as string,
        supabaseKey as string
      );
      console.log('StorageService initialized with Supabase Storage');
    } else {
      this.ensureUploadsDirectory();
      console.log('StorageService initialized with local storage:', this.uploadsDir);
    }
  }

  private ensureUploadsDirectory() {
    fs.ensureDirSync(this.uploadsDir);
  }

  async saveFile(file: Express.Multer.File, documentId: string): Promise<StoredFile> {
    const ext = path.extname(file.originalname);
    const filename = `${documentId}${ext}`;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey && this.supabase) {
      return this.saveToSupabase(file, filename);
    } else {
      return this.saveToLocal(file, filename);
    }
  }

  private async saveToSupabase(file: Express.Multer.File, filename: string): Promise<StoredFile> {
    try {
      const { data, error } = await this.supabase.storage
        .from('knowledge-files')
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;
      if (!this.supabase) throw new Error('Supabase client not initialized');

      const { data: publicUrlData } = this.supabase.storage
        .from('knowledge-files')
        .getPublicUrl(filename);

      return {
        path: filename,
        url: publicUrlData.publicUrl,
        size: file.size
      };
    } catch (error) {
      console.error('Error saving to Supabase Storage:', error);
      throw error;
    }
  }

  private async saveToLocal(file: Express.Multer.File, filename: string): Promise<StoredFile> {
    try {
      const filePath = path.join(this.uploadsDir, filename);
      await fs.writeFile(filePath, file.buffer);

      const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
      
      return {
        path: filePath,
        url: `${baseUrl}/uploads/${filename}`,
        size: file.size
      };
    } catch (error) {
      console.error('Error saving to local storage:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (this.useSupabaseStorage && this.supabase) {
      await this.deleteFromSupabase(filePath);
    } else {
      await this.deleteFromLocal(filePath);
    }
  }

  private async deleteFromSupabase(filePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from('knowledge-files')
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting from Supabase Storage:', error);
    }
  }

  private async deleteFromLocal(filePath: string): Promise<void> {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting from local storage:', error);
    }
  }

  async getLocalFilePath(filePath: string): Promise<string> {
    if (this.useSupabaseStorage) {
      const { data, error } = await this.supabase.storage
        .from('knowledge-files')
        .download(filePath);

      if (error) throw error;
      
      const tempPath = path.join(this.uploadsDir, path.basename(filePath));
      await fs.writeFile(tempPath, data);
      return tempPath;
    } else {
      return filePath;
    }
  }
}

export const storageService = new StorageService();
