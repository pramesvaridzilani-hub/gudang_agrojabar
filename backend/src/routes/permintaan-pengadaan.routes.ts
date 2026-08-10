import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  getDemandSignal,
  listPermintaanPengadaan,
  createPermintaanPengadaan,
  updatePermintaanPengadaan,
  kirimPermintaanKePetani,
  updateKomitmenFromPetani,
  updateStatusTracking,
  submitQc,
  expirePermintaanPengadaan,
} from '../controllers/permintaan-pengadaan.controller';

const router = Router();

// Role definitions
const staf = requireRole(['STAF_GUDANG', 'ADMIN_GUDANG', 'SUPER_ADMIN']);
const kepalaGudang = requireRole(['ADMIN_GUDANG', 'SUPER_ADMIN']);

// 1. Demand signal dari ECOMMERCE (semua role bisa lihat)
router.get(
  '/demand-signal',
  authMiddleware as any,
  staf,
  getDemandSignal as any
);

// 2. List permintaan pengadaan (semua role bisa lihat)
router.get(
  '/',
  authMiddleware as any,
  staf,
  listPermintaanPengadaan as any
);

// 3. Buat permintaan baru (staf & Kepala Gudang)
router.post(
  '/',
  authMiddleware as any,
  staf,
  createPermintaanPengadaan as any
);

// 4. Edit permintaan (hanya DRAFT) - staf & kepala gudang
router.patch(
  '/:id',
  authMiddleware as any,
  staf,
  updatePermintaanPengadaan as any
);

// 5. Kirim ke PETANI (staf & Kepala Gudang)
router.post(
  '/:id/kirim',
  authMiddleware as any,
  staf,
  kirimPermintaanKePetani as any
);

// 6. Update Status Tracking (Simulation/Progress)
router.patch(
  '/:id/status-tracking',
  authMiddleware as any,
  staf,
  updateStatusTracking as any
);

// 7. Submit QC & Selesai
router.post(
  '/:id/qc-selesai',
  authMiddleware as any,
  staf,
  submitQc as any
);

// 8. Expire Produk (staf & Kepala Gudang)
router.post(
  '/:id/expire',
  authMiddleware as any,
  staf,
  expirePermintaanPengadaan as any
);

import { petaniApiKeyMiddleware } from '../middleware/petani-api-key.middleware';

// 8. Webhook callback dari PETANI service (verified by API Key)
router.post('/:id/komitmen', petaniApiKeyMiddleware, updateKomitmenFromPetani as any);

export default router;
