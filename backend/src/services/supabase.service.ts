import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️ Supabase URL or Key is missing in .env. Storage features might not work.');
}

// Inisialisasi Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Upload file buffer ke Supabase Storage Bucket
 * @param bucketName Nama bucket (contoh: 'gudang-storage')
 * @param folderPath Path dan nama file di dalam bucket (contoh: 'intake/bukti-pembayaran/file.jpg')
 * @param fileBuffer Buffer dari file yang di-upload
 * @param mimeType MimeType file (contoh: 'image/jpeg')
 * @returns Public URL dari file yang di-upload
 */
export const uploadFileToBucket = async (
  bucketName: string,
  folderPath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(folderPath, fileBuffer, {
        contentType: mimeType,
        upsert: true, // Timpa file jika namanya sama
      });

    if (error) {
      throw error;
    }

    // Dapatkan Public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(folderPath);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`Gagal upload ke bucket ${bucketName}:`, error);
    throw error;
  }
};
