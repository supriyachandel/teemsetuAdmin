import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

/** Local + S3-ready file storage abstraction */
export class StorageService {
  private driver = env.STORAGE_DRIVER;

  async upload(file: Express.Multer.File, folder = 'general'): Promise<{
    url: string;
    storage: 'LOCAL' | 'S3';
  }> {
    if (this.driver === 's3') {
      return this.uploadToS3(file, folder);
    }
    return this.uploadLocal(file, folder);
  }

  private async uploadLocal(file: Express.Multer.File, folder: string) {
    const uploadDir = path.resolve(env.LOCAL_UPLOAD_PATH, folder);
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}${path.extname(file.originalname)}`;
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, file.buffer);
    return {
      url: `${env.API_URL}/uploads/${folder}/${filename}`,
      storage: 'LOCAL' as const,
    };
  }

  private async uploadToS3(
    _file: Express.Multer.File,
    _folder: string
  ): Promise<{ url: string; storage: 'S3' }> {
    // S3 implementation ready for Phase 2+
    throw new Error('S3 storage not configured. Set AWS env variables.');
  }
}

export const storageService = new StorageService();
