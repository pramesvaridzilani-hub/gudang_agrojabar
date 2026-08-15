import { Router } from 'express';
import multer from 'multer';
import { uploadFile } from '../controllers/upload.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Konfigurasi Multer untuk menggunakan memory storage (buffer)
// Limit file size diatur ke 5MB untuk mencegah overload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

// Endpoint untuk upload file
router.post('/', authMiddleware, upload.single('file'), uploadFile);

export default router;
