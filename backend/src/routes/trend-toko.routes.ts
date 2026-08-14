import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/gudang/:id/trend-toko-langganan
router.get('/:id/trend-toko-langganan', async (req: Request, res: Response) => {
  try {
    const { id: gudangId } = req.params;

    // Pastikan gudang exists
    const gudang = await prisma.gudang.findUnique({
      where: { id: gudangId }
    });

    if (!gudang) {
      return res.status(404).json({ error: 'Gudang tidak ditemukan' });
    }

    // Ambil data nyata dari E-Commerce Service
    const axios = require('axios');
    const ecomUrl = process.env.ECOMMERCE_BACKEND_URL || 'https://api.agro-ecommerce.web.id';
    const ecomKey = process.env.ECOMMERCE_API_KEY || 'ecommerce-nestjs-to-gudang-express-secure-key';

    const response = await axios.get(`${ecomUrl}/api/analytics/demand-signal/gudang?gudangId=${gudangId}`, {
      headers: { 'x-api-key': ecomKey }
    });

    const payload = response.data?.data || {};
    const ecomData = payload.data || [];

    // Ambil Produk Gudang saat ini untuk mendapatkan stok riil
    const produkGudangList = await prisma.produkGudang.findMany({
      where: { gudangId },
      include: { masterKomoditas: true }
    });

    // Mapping sesuai harapan Frontend
    const result = ecomData.map((item: any) => {
      const globalKode = item.kodeKomoditasGlobal;
      const matchingProduk = produkGudangList.find(
        (p) => p.masterKomoditas?.kodeKomoditasGlobal === globalKode
      );
      
      const stokGudangSaatIni = matchingProduk ? matchingProduk.stok : 0;
      const salesVelocityKgPerDay = Math.round(item.jumlahTerjualKg / 30) || 0;

      let trendStatus = 'STABIL';
      if (item.trendArah === 'UP' && item.trendPersen > 20) trendStatus = 'NAIK_TAJAM';
      else if (item.trendArah === 'UP') trendStatus = 'NAIK';
      else if (item.trendArah === 'DOWN') trendStatus = 'TURUN';

      return {
        kodeKomoditasGlobal: globalKode,
        komoditasNama: item.komoditasNama,
        jumlahTokoPasar: item.jumlahSeller,
        salesVelocityKgPerDay,
        trendStatus,
        trendPersen: item.trendPersen || 0,
        rekomendasiBufferKg: salesVelocityKgPerDay * 2, // 2 days buffer
        stokGudangSaatIni,
      };
    });

    res.json({
      gudangId: gudang.id,
      gudangNama: gudang.nama,
      lastUpdated: new Date().toISOString(),
      periodLabel: payload.period?.label || 'Bulan Ini',
      prevPeriodLabel: payload.prevPeriod?.label || 'Bulan Lalu',
      data: result
    });
  } catch (error: any) {
    console.error('Error fetching trend toko:', error.message);
    res.status(500).json({ error: 'Terjadi kesalahan server saat mengambil data tren toko dari e-commerce.' });
  }
});
// GET /api/gudang/:id/analytics/produk-terlaris
router.get('/:id/analytics/produk-terlaris', async (req: Request, res: Response) => {
  try {
    const { period, limit, sortBy, startDate, endDate, kategoriId } = req.query;
    
    const axios = require('axios');
    const ecomUrl = process.env.ECOMMERCE_BACKEND_URL || 'https://api.agro-ecommerce.web.id';
    const ecomKey = process.env.ECOMMERCE_API_KEY || 'ecommerce-nestjs-to-gudang-express-secure-key';

    const params = new URLSearchParams();
    if (period) params.set('period', period as string);
    if (limit) params.set('limit', limit as string);
    if (sortBy) params.set('sortBy', sortBy as string);
    if (startDate) params.set('startDate', startDate as string);
    if (endDate) params.set('endDate', endDate as string);
    if (kategoriId) params.set('kategoriId', kategoriId as string);

    const response = await axios.get(`${ecomUrl}/api/analytics/produk-terlaris?${params.toString()}`, {
      headers: { 'x-api-key': ecomKey }
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching produk terlaris:', error.message);
    res.status(500).json({ error: 'Gagal mengambil data produk terlaris dari e-commerce.' });
  }
});

// GET /api/gudang/:id/analytics/tren-komoditas-global
router.get('/:id/analytics/tren-komoditas-global', async (req: Request, res: Response) => {
  try {
    const { kodeKomoditasGlobal, bulanKe } = req.query;
    
    const axios = require('axios');
    const ecomUrl = process.env.ECOMMERCE_BACKEND_URL || 'https://api.agro-ecommerce.web.id';
    const ecomKey = process.env.ECOMMERCE_API_KEY || 'ecommerce-nestjs-to-gudang-express-secure-key';

    const params = new URLSearchParams();
    if (kodeKomoditasGlobal) params.set('kodeKomoditasGlobal', kodeKomoditasGlobal as string);
    if (bulanKe) params.set('bulanKe', bulanKe as string);

    const response = await axios.get(`${ecomUrl}/api/analytics/tren-komoditas-global?${params.toString()}`, {
      headers: { 'x-api-key': ecomKey }
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching tren komoditas global:', error.message);
    res.status(500).json({ error: 'Gagal mengambil data tren komoditas global dari e-commerce.' });
  }
});

export default router;
