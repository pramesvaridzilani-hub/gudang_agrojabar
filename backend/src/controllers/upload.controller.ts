import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { uploadFileToBucket } from '../services/supabase.service';

/**
 * Upload file generic ke bucket
 */
export const uploadFile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diunggah' });
    }

    // Default ke bucket 'gudang-storage' atau sesuai nama yang Anda buat di Supabase
    // Mengambil nama folder tujuannya dari req.body (misalnya: 'intake/bukti-pembayaran')
    const { folder = 'umum' } = req.body;
    const bucketName = 'gudang-storage'; 
    
    const file = req.file;
    // Generate nama file unik menggunakan timestamp
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const folderPath = `${folder}/${fileName}`;

    // Upload ke Supabase
    const publicUrl = await uploadFileToBucket(
      bucketName,
      folderPath,
      file.buffer,
      file.mimetype
    );

    return res.status(200).json({
      statusCode: 200,
      message: 'File berhasil diunggah',
      data: {
        url: publicUrl,
        path: folderPath,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      statusCode: 500,
      message: 'Gagal mengunggah file',
      error: error.message,
    });
  }
};
