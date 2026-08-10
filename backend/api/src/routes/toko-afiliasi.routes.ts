import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/toko-afiliasi
router.get('/', (req: Request, res: Response) => {
  // Mock data untuk Toko Afiliasi
  const mockStores = [
    { id: '1', nama: 'Toko Segar Abadi', status: 'AKTIF' },
    { id: '2', nama: 'Sayur Mart', status: 'AKTIF' },
    { id: '3', nama: 'Grosir Sayur Bandung', status: 'AKTIF' },
  ];
  
  res.json({ data: mockStores });
});

export default router;
