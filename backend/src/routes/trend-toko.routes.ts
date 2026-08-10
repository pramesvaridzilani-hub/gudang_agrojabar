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
    const ecomUrl = process.env.ECOMMERCE_BACKEND_URL || 'http://127.0.0.1:4000';
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

export default router;
