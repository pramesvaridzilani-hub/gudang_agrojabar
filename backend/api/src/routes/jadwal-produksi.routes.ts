import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  hitungPreviewJadwal,
  createJadwal,
  getJadwalList,
  getJadwalById,
  updateJadwalStatus,
  updateRealisasiHari,
  addTenagaKerja,
  deleteTenagaKerja,
  getKapasitasTanggal,
  eksekusiJadwal,
  getAntreanProduksi,
  getProductionDemandPool,
  cancelDemand,
} from '../controllers/jadwal-produksi.controller';

const router = Router();

// Public preview — tidak perlu auth (opsional)
router.post('/hitung', hitungPreviewJadwal);

// Kapasitas cek
router.get('/kapasitas', authMiddleware, getKapasitasTanggal);

// CRUD jadwal
router.get('/', authMiddleware, getJadwalList);
router.get('/antrean', authMiddleware, getAntreanProduksi);
router.get('/demand-pool', authMiddleware, getProductionDemandPool as any);
router.post('/demand-pool/cancel', authMiddleware, cancelDemand as any);
router.post('/', authMiddleware, createJadwal);
router.get('/:id', authMiddleware, getJadwalById);
router.patch('/:id/status', authMiddleware, updateJadwalStatus);
router.post('/:id/eksekusi', authMiddleware, eksekusiJadwal);

// Manajemen hari produksi
router.patch('/hari/:hariId', authMiddleware, updateRealisasiHari);

// Tenaga kerja borongan
router.post('/hari/:hariId/tenaga-kerja', authMiddleware, addTenagaKerja);
router.delete('/tenaga-kerja/:id', authMiddleware, deleteTenagaKerja);

export default router;
