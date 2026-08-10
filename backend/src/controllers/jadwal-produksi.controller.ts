import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// ─── Helper: Hitung jadwal otomatis ─────────────────────────────────────────
function hitungJadwal(volumeTotalKg: number, tenggat: Date, kapasitasHarianKg = 1000) {
  const estimasiHari = Math.ceil(volumeTotalKg / kapasitasHarianKg);

  // Hitung tanggal mulai: mundur dari tenggat
  const tanggalMulai = new Date(tenggat);
  tanggalMulai.setDate(tanggalMulai.getDate() - estimasiHari + 1);
  tanggalMulai.setHours(0, 0, 0, 0);

  const tanggalSelesai = new Date(tanggalMulai);
  tanggalSelesai.setDate(tanggalSelesai.getDate() + estimasiHari - 1);
  tanggalSelesai.setHours(23, 59, 59, 999);

  // Bagi volume per hari
  const hariProduksi = [];
  for (let i = 0; i < estimasiHari; i++) {
    const tgl = new Date(tanggalMulai);
    tgl.setDate(tgl.getDate() + i);
    const sisaVolume = volumeTotalKg - i * kapasitasHarianKg;
    hariProduksi.push({
      hariKe: i + 1,
      tanggal: new Date(tgl),
      targetKg: Math.min(kapasitasHarianKg, sisaVolume),
    });
  }

  return { estimasiHari, tanggalMulai, tanggalSelesai, hariProduksi };
}

// ─── POST /api/jadwal-produksi/hitung ─────────────────────────────────────────
// Preview kalkulasi jadwal tanpa menyimpan ke DB
export const hitungPreviewJadwal = async (req: Request, res: Response) => {
  try {
    const { volumeTotalKg, tenggat, kapasitasHarianKg } = req.body;

    if (!volumeTotalKg || !tenggat) {
      return res.status(400).json({ error: 'volumeTotalKg dan tenggat wajib diisi' });
    }

    const tenggatDate = new Date(tenggat);
    const kapasitas = kapasitasHarianKg ? parseFloat(kapasitasHarianKg) : 1000;
    const hasil = hitungJadwal(parseFloat(volumeTotalKg), tenggatDate, kapasitas);

    // Cek apakah ada jadwal yang overlap di tanggal tersebut
    const overlap: any[] = [];
    for (const hari of hasil.hariProduksi) {
      const existingHari = await prisma.hariProduksi.findMany({
        where: {
          tanggal: {
            gte: new Date(hari.tanggal.toISOString().split('T')[0] + 'T00:00:00.000Z'),
            lt: new Date(hari.tanggal.toISOString().split('T')[0] + 'T23:59:59.999Z'),
          },
          statusHari: { not: 'SELESAI' },
        },
        include: { jadwal: { select: { komoditasNama: true, statusJadwal: true } } },
      });

      const totalTerjadwal = existingHari.reduce((s, h) => s + h.targetKg, 0);
      if (totalTerjadwal + hari.targetKg > kapasitas) {
        overlap.push({
          tanggal: hari.tanggal,
          kapasitasTerpakai: totalTerjadwal,
          tambahanDiminta: hari.targetKg,
          kelebihan: totalTerjadwal + hari.targetKg - kapasitas,
        });
      }
    }

    return res.json({
      statusCode: 200,
      data: {
        ...hasil,
        kapasitasHarianKg: kapasitas,
        estimasiBiayaBorongan: parseFloat(volumeTotalKg) * 1500, // Rp 1.500/kg
        peringatanOverlap: overlap,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── POST /api/jadwal-produksi ─────────────────────────────────────────────────
// Simpan jadwal baru beserta hari-hari produksinya
  export const createJadwal = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { gudangId, komoditasNama, volumeTotalKg, tenggat, kapasitasHarianKg, pengajuanId, permintaanPengadaanId, catatanJadwal, detailKomoditas } = req.body;
  
      if (!gudangId || !komoditasNama || !volumeTotalKg || !tenggat) {
        return res.status(400).json({ error: 'gudangId, komoditasNama, volumeTotalKg, tenggat wajib diisi' });
      }
  
      const tenggatDate = new Date(tenggat);
      const kapasitas = kapasitasHarianKg ? parseFloat(kapasitasHarianKg) : 1000;
      const hasil = hitungJadwal(parseFloat(volumeTotalKg), tenggatDate, kapasitas);
  
      const jadwal = await prisma.jadwalProduksi.create({
        data: {
          gudangId,
          pengajuanId: pengajuanId || null,
          permintaanPengadaanId: permintaanPengadaanId || null,
          komoditasNama,
          volumeTotalKg: parseFloat(volumeTotalKg),
          detailKomoditas: detailKomoditas ? detailKomoditas : null,
          kapasitasHarianKg: kapasitas,
        tenggat: tenggatDate,
        tanggalMulai: hasil.tanggalMulai,
        tanggalSelesai: hasil.tanggalSelesai,
        estimasiHari: hasil.estimasiHari,
        statusJadwal: 'AKTIF',
        catatanJadwal: catatanJadwal || null,
        hariProduksi: {
          create: hasil.hariProduksi.map((h) => ({
            hariKe: h.hariKe,
            tanggal: h.tanggal,
            targetKg: h.targetKg,
            statusHari: 'BELUM',
          })),
        },
      },
      include: {
        hariProduksi: { orderBy: { hariKe: 'asc' } },
      },
    });

    // --- AUTO-RESERVASI DEMAND POOL ---
    if (detailKomoditas && Array.isArray(detailKomoditas)) {
      const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
      const requiredPacks: { nama: string; ukuranKg: number; pack: number }[] = [];

      for (const item of detailKomoditas) {
        const rawVolume = parseFloat(item.volumeKg) || 0;
        const loss = YIELD_LOSS_MAP[item.nama] || 0;
        const penyusutanKg = rawVolume * (loss / 100);
        const hasilJadiKg = Math.round(Math.max(0, rawVolume - penyusutanKg));

        if (item.kemasan === 'kombinasi') {
          const jumlahBesar = parseInt(item.kemasanKombinasiBesar) || 0;
          const sisa = Math.max(0, hasilJadiKg - (jumlahBesar * 2.5));
          const jumlahKecil = Math.floor(sisa / 1);
          if (jumlahBesar > 0) requiredPacks.push({ nama: item.nama, ukuranKg: 2.5, pack: jumlahBesar });
          if (jumlahKecil > 0) requiredPacks.push({ nama: item.nama, ukuranKg: 1, pack: jumlahKecil });
        } else {
          const ukuranKemasan = item.kemasan === 'kustom' ? (parseFloat(item.kemasanKustom) || 1) : parseFloat(item.kemasan);
          const estimasiKemasan = hasilJadiKg > 0 && ukuranKemasan > 0 ? Math.floor(hasilJadiKg / ukuranKemasan) : 0;
          if (estimasiKemasan > 0) {
            requiredPacks.push({ nama: item.nama, ukuranKg: ukuranKemasan, pack: estimasiKemasan });
          }
        }
      }

      for (const reqPack of requiredPacks) {
        let sisaDibutuhkan = reqPack.pack;
        if (sisaDibutuhkan <= 0) continue;

        const openPengajuan = await prisma.pengajuanStokToko.findMany({
          where: {
            status: { in: ['DIAJUKAN', 'MENUNGGU_SEBAGIAN'] },
          },
          orderBy: { createdAt: 'asc' }, // FIFO
          include: { items: { include: { kemasanDetail: true } } }
        });

        for (const pengajuan of openPengajuan) {
          if (sisaDibutuhkan <= 0) break;
          const targetItem = pengajuan.items.find((i: any) => i.produkNama === reqPack.nama);
          if (!targetItem) continue;

          if (targetItem.kemasanDetail && targetItem.kemasanDetail.length > 0) {
            const detail = targetItem.kemasanDetail.find((d: any) => Math.abs(Number(d.ukuranKg) - Number(reqPack.ukuranKg)) < 0.01);
            if (detail) {
              const maxBisaDireservasi = detail.jumlahKemasan - (detail.jumlahDireservasi || 0);
              if (maxBisaDireservasi > 0) {
                const ambil = Math.min(sisaDibutuhkan, maxBisaDireservasi);
                await prisma.itemPengajuanStokKemasan.update({
                  where: { id: detail.id },
                  data: { jumlahDireservasi: (detail.jumlahDireservasi || 0) + ambil }
                });
                sisaDibutuhkan -= ambil;
              }
            }
          } else if (targetItem.ukuranKemasanKg === reqPack.ukuranKg) {
            const maxBisaDireservasi = (targetItem.jumlahKemasan || 0) - (targetItem.jumlahDireservasi || 0);
            if (maxBisaDireservasi > 0) {
              const ambil = Math.min(sisaDibutuhkan, maxBisaDireservasi);
              await prisma.itemPengajuanStok.update({
                where: { id: targetItem.id },
                data: { jumlahDireservasi: (targetItem.jumlahDireservasi || 0) + ambil }
              });
              sisaDibutuhkan -= ambil;
            }
          }
        }
      }
    }
    // ----------------------------------

    return res.status(201).json({ statusCode: 201, data: jadwal });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── GET /api/jadwal-produksi ───────────────────────────────────────────────
// Daftar jadwal (filter: gudangId, status)
export const getJadwalList = async (req: Request, res: Response) => {
  try {
    const { gudangId, statusJadwal } = req.query;

    const where: any = {};
    if (gudangId) where.gudangId = String(gudangId);
    if (statusJadwal) where.statusJadwal = String(statusJadwal);

    const data = await prisma.jadwalProduksi.findMany({
      where,
      orderBy: { tanggalMulai: 'asc' },
      include: {
        hariProduksi: {
          orderBy: { hariKe: 'asc' },
          include: {
            tenagaKerja: true,
          },
        },
      },
    });

    // Ambil detail permintaan terkait untuk sinkronisasi estimasiBahanBakuRp
    const allRequestIds: string[] = [];
    for (const j of data) {
      if (j.permintaanPengadaanId) {
        allRequestIds.push(j.permintaanPengadaanId);
      }
      if (j.detailKomoditas && Array.isArray(j.detailKomoditas)) {
        const details = j.detailKomoditas as any[];
        for (const item of details) {
          if (item) {
            if (item.permintaanId) allRequestIds.push(String(item.permintaanId));
            if (item.permintaanPengadaanId) allRequestIds.push(String(item.permintaanPengadaanId));
            if (Array.isArray(item.permintaanIds)) allRequestIds.push(...item.permintaanIds.map(String));
          }
        }
      }
    }

    const linkedRequests = await prisma.permintaanPengadaan.findMany({
      where: { id: { in: allRequestIds } },
      select: { id: true, targetKg: true, hargaAcuanPerKg: true }
    });

    const requestMap = new Map<string, { targetKg: number, hargaAcuanPerKg: number }>();
    for (const req of linkedRequests) {
      requestMap.set(req.id, {
        targetKg: req.targetKg || 0,
        hargaAcuanPerKg: req.hargaAcuanPerKg || 0
      });
    }

    // Hitung summary per jadwal
    const dataWithSummary = data.map((jadwal) => {
      // Sinkronisasi estimasiBahanBakuRp per item komoditas
      let detailKomoditas = jadwal.detailKomoditas;
      if (detailKomoditas && Array.isArray(detailKomoditas)) {
        detailKomoditas = (detailKomoditas as any[]).map((item) => {
          if (item && typeof item === 'object') {
            const ids = [];
            if (item.permintaanId) ids.push(String(item.permintaanId));
            if (item.permintaanPengadaanId) ids.push(String(item.permintaanPengadaanId));
            if (Array.isArray(item.permintaanIds)) ids.push(...item.permintaanIds.map(String));
            if (ids.length === 0 && jadwal.permintaanPengadaanId) {
              ids.push(jadwal.permintaanPengadaanId);
            }

            let computedCost = 0;
            let hasLinkedRequest = false;
            for (const id of ids) {
              const req = requestMap.get(id);
              if (req) {
                computedCost += req.targetKg * req.hargaAcuanPerKg;
                hasLinkedRequest = true;
              }
            }

            return {
              ...item,
              estimasiBahanBakuRp: hasLinkedRequest ? computedCost : (item.estimasiBahanBakuRp || 0)
            };
          }
          return item;
        });
      }

      const totalRealisasi = jadwal.hariProduksi.reduce((s, h) => s + (h.realisasiKg || 0), 0);
      const totalBiayaBorongan = jadwal.hariProduksi.reduce(
        (s, h) => s + h.tenagaKerja.reduce((ts, t) => ts + t.totalUpah, 0),
        0
      );
      const hariSelesai = jadwal.hariProduksi.filter((h) => h.statusHari === 'SELESAI').length;
      return {
        ...jadwal,
        detailKomoditas,
        summary: {
          totalRealisasiKg: totalRealisasi,
          persenSelesai: jadwal.volumeTotalKg > 0 ? Math.round((totalRealisasi / jadwal.volumeTotalKg) * 100) : 0,
          hariSelesai,
          hariTotal: jadwal.estimasiHari,
          totalBiayaBorongan,
        },
      };
    });

    return res.json({ statusCode: 200, data: dataWithSummary });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── GET /api/jadwal-produksi/:id ──────────────────────────────────────────
// Detail jadwal lengkap
export const getJadwalById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const jadwal = await prisma.jadwalProduksi.findUnique({
      where: { id },
      include: {
        hariProduksi: {
          orderBy: { hariKe: 'asc' },
          include: {
            tenagaKerja: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!jadwal) return res.status(404).json({ error: 'Jadwal tidak ditemukan' });

    // Ambil detail permintaan terkait untuk sinkronisasi estimasiBahanBakuRp
    const allRequestIds: string[] = [];
    if (jadwal.permintaanPengadaanId) {
      allRequestIds.push(jadwal.permintaanPengadaanId);
    }
    if (jadwal.detailKomoditas && Array.isArray(jadwal.detailKomoditas)) {
      const details = jadwal.detailKomoditas as any[];
      for (const item of details) {
        if (item) {
          if (item.permintaanId) allRequestIds.push(String(item.permintaanId));
          if (item.permintaanPengadaanId) allRequestIds.push(String(item.permintaanPengadaanId));
          if (Array.isArray(item.permintaanIds)) allRequestIds.push(...item.permintaanIds.map(String));
        }
      }
    }

    const linkedRequests = await prisma.permintaanPengadaan.findMany({
      where: { id: { in: allRequestIds } },
      select: { id: true, targetKg: true, hargaAcuanPerKg: true }
    });

    const requestMap = new Map<string, { targetKg: number, hargaAcuanPerKg: number }>();
    for (const req of linkedRequests) {
      requestMap.set(req.id, {
        targetKg: req.targetKg || 0,
        hargaAcuanPerKg: req.hargaAcuanPerKg || 0
      });
    }

    // Sinkronisasi estimasiBahanBakuRp per item komoditas
    let detailKomoditas = jadwal.detailKomoditas;
    if (detailKomoditas && Array.isArray(detailKomoditas)) {
      detailKomoditas = (detailKomoditas as any[]).map((item) => {
        if (item && typeof item === 'object') {
          const ids = [];
          if (item.permintaanId) ids.push(String(item.permintaanId));
          if (item.permintaanPengadaanId) ids.push(String(item.permintaanPengadaanId));
          if (Array.isArray(item.permintaanIds)) ids.push(...item.permintaanIds.map(String));
          if (ids.length === 0 && jadwal.permintaanPengadaanId) {
            ids.push(jadwal.permintaanPengadaanId);
          }

          let computedCost = 0;
          let hasLinkedRequest = false;
          for (const id of ids) {
            const req = requestMap.get(id);
            if (req) {
              computedCost += req.targetKg * req.hargaAcuanPerKg;
              hasLinkedRequest = true;
            }
          }

          return {
            ...item,
            estimasiBahanBakuRp: hasLinkedRequest ? computedCost : (item.estimasiBahanBakuRp || 0)
          };
        }
        return item;
      });
    }

    const totalRealisasi = jadwal.hariProduksi.reduce((s, h) => s + (h.realisasiKg || 0), 0);
    const totalBiayaBorongan = jadwal.hariProduksi.reduce(
      (s, h) => s + h.tenagaKerja.reduce((ts, t) => ts + t.totalUpah, 0),
      0
    );

    return res.json({
      statusCode: 200,
      data: {
        ...jadwal,
        detailKomoditas,
        summary: {
          totalRealisasiKg: totalRealisasi,
          persenSelesai: jadwal.volumeTotalKg > 0 ? Math.round((totalRealisasi / jadwal.volumeTotalKg) * 100) : 0,
          hariSelesai: jadwal.hariProduksi.filter((h) => h.statusHari === 'SELESAI').length,
          totalBiayaBorongan,
          estimasiBiayaBoronganTotal: jadwal.volumeTotalKg * 1500,
        },
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── GET /api/jadwal-produksi/antrean ─────────────────────────────────────────
export const getAntreanProduksi = async (req: Request, res: Response) => {
  try {
    const { gudangId } = req.query;
    if (!gudangId) return res.status(400).json({ error: 'gudangId wajib diisi' });

    const pengajuanList = await prisma.pengajuanStokToko.findMany({
      where: { 
        gudangId: String(gudangId),
        status: 'DIPROSES',
      },
      include: { items: true }
    });

    const jadwalList = await prisma.jadwalProduksi.findMany({
      where: { gudangId: String(gudangId) },
      select: { pengajuanId: true, permintaanPengadaanId: true }
    });
    const jadwalPengajuanIds = jadwalList.map(j => j.pengajuanId).filter(Boolean);
    const jadwalPermintaanIds = jadwalList.map(j => j.permintaanPengadaanId).filter(Boolean);

    const pendingPengajuan = pengajuanList.filter(p => !jadwalPengajuanIds.includes(p.id));

    const antrean = [];
    for (const pengajuan of pendingPengajuan) {
      const permintaan = await prisma.permintaanPengadaan.findFirst({
        where: {
          sumberOrderId: pengajuan.id,
          status: { in: ['TIBA', 'SELESAI_QC', 'TERPENUHI', 'SEBAGIAN_TERPENUHI', 'DALAM_PENGANTARAN'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (permintaan) {
        antrean.push({
          pengajuanId: pengajuan.id,
          tokoNama: pengajuan.tokoNama,
          pengajuanCreatedAt: pengajuan.createdAt,
          items: pengajuan.items,
          permintaanPengadaanId: permintaan.id,
          nomorOrderPetani: permintaan.nomorOrder,
          komoditasPetani: permintaan.komoditasNama,
          volumePetaniKg: permintaan.targetKg,
          statusPermintaan: permintaan.status,
          tanggalTiba: permintaan.tanggalTiba,
          rencanaProduksi: null,
        });
      }
    }

    // Ambil order manual yang sudah tiba tapi belum dijadwalkan
    const manualRequests = await prisma.permintaanPengadaan.findMany({
      where: {
        gudangId: String(gudangId),
        tipePesanan: 'MANUAL',
        status: { in: ['TIBA', 'SELESAI_QC', 'TERPENUHI', 'SEBAGIAN_TERPENUHI', 'DALAM_PENGANTARAN'] },
        id: { notIn: jadwalPermintaanIds as string[] }
      },
      orderBy: { createdAt: 'desc' }
    });

    for (const req of manualRequests) {
      antrean.push({
        pengajuanId: '',
        tokoNama: 'Stok Internal (Manual)',
        pengajuanCreatedAt: req.createdAt,
        items: [],
        permintaanPengadaanId: req.id,
        nomorOrderPetani: req.nomorOrder,
        komoditasPetani: req.komoditasNama,
        volumePetaniKg: req.targetKg,
        statusPermintaan: req.status,
        tanggalTiba: req.tanggalTiba,
        rencanaProduksi: req.rencanaProduksi,
      });
    }

    return res.json({ statusCode: 200, data: antrean });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── PATCH /api/jadwal-produksi/:id/status ─────────────────────────────────
// Ubah status jadwal (AKTIF → SELESAI / BATAL)
export const updateJadwalStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { statusJadwal, catatanJadwal } = req.body;

    const validStatus = ['DRAFT', 'AKTIF', 'SELESAI', 'BATAL'];
    if (!validStatus.includes(statusJadwal)) {
      return res.status(400).json({ error: `Status harus salah satu dari: ${validStatus.join(', ')}` });
    }

    const updated = await prisma.jadwalProduksi.update({
      where: { id },
      data: { statusJadwal, catatanJadwal: catatanJadwal ?? undefined },
    });

    return res.json({ statusCode: 200, data: updated });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── PATCH /api/jadwal-produksi/hari/:hariId ──────────────────────────────
// Update realisasi produksi hari tertentu
export const updateRealisasiHari = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hariId } = req.params;
    const { realisasiKg, statusHari, catatan } = req.body;

    const hari = await prisma.hariProduksi.findUnique({ where: { id: hariId } });
    if (!hari) return res.status(404).json({ error: 'Hari produksi tidak ditemukan' });

    const validStatusHari = ['BELUM', 'BERJALAN', 'SELESAI'];
    if (statusHari && !validStatusHari.includes(statusHari)) {
      return res.status(400).json({ error: `statusHari harus salah satu dari: ${validStatusHari.join(', ')}` });
    }

    const updated = await prisma.hariProduksi.update({
      where: { id: hariId },
      data: {
        realisasiKg: realisasiKg !== undefined ? parseFloat(realisasiKg) : undefined,
        statusHari: statusHari || undefined,
        catatan: catatan ?? undefined,
      },
      include: {
        tenagaKerja: true,
      },
    });

    return res.json({ statusCode: 200, data: updated });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── POST /api/jadwal-produksi/hari/:hariId/tenaga-kerja ──────────────────
// Tambah catatan pekerja borongan untuk hari tertentu
export const addTenagaKerja = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hariId } = req.params;
    const { namaPekerja, kgDikerjakan, tarifPerKg, catatan } = req.body;

    if (!namaPekerja || !kgDikerjakan) {
      return res.status(400).json({ error: 'namaPekerja dan kgDikerjakan wajib diisi' });
    }

    const hari = await prisma.hariProduksi.findUnique({ where: { id: hariId } });
    if (!hari) return res.status(404).json({ error: 'Hari produksi tidak ditemukan' });

    const tarif = tarifPerKg ? parseFloat(tarifPerKg) : 1500;
    const kgFloat = parseFloat(kgDikerjakan);
    const totalUpah = kgFloat * tarif;

    const pekerja = await prisma.tenagaKerjaBorongan.create({
      data: {
        hariProduksiId: hariId,
        namaPekerja: String(namaPekerja).trim(),
        kgDikerjakan: kgFloat,
        tarifPerKg: tarif,
        totalUpah,
        catatan: catatan || null,
      },
    });

    return res.status(201).json({
      statusCode: 201,
      data: pekerja,
      message: `Upah borongan ${namaPekerja}: Rp ${totalUpah.toLocaleString('id-ID')}`,
    });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── DELETE /api/jadwal-produksi/tenaga-kerja/:id ─────────────────────────
// Hapus catatan pekerja borongan
export const deleteTenagaKerja = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.tenagaKerjaBorongan.delete({ where: { id } });
    return res.json({ statusCode: 200, message: 'Data pekerja dihapus' });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── POST /api/jadwal-produksi/:id/eksekusi ─────────────────────────────────
export const eksekusiJadwal = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { pekerja, laporanEksekusi } = req.body;

    const jadwal = await prisma.jadwalProduksi.findUnique({
      where: { id },
      include: { hariProduksi: { orderBy: { hariKe: 'asc' } } }
    });

    if (!jadwal) return res.status(404).json({ error: 'Jadwal tidak ditemukan' });

    // 1. Tambahkan tenaga kerja borongan ke Hari Produksi pertama
    if (pekerja && Array.isArray(pekerja) && pekerja.length > 0) {
       const hariId = jadwal.hariProduksi[0]?.id; 
       if (hariId) {
          await prisma.tenagaKerjaBorongan.createMany({
            data: pekerja.map((p: any) => {
              const tarif = parseFloat(p.tarifPerKg) || 1500;
              const kg = parseFloat(p.kgDikerjakan) || 0;
              return {
                hariProduksiId: hariId,
                namaPekerja: p.namaPegawai,
                kgDikerjakan: kg,
                tarifPerKg: tarif,
                totalUpah: kg * tarif,
                catatan: p.catatan || null
              };
            })
          });
       }
    }

    // 2. Update status jadwal jadi SELESAI dan simpan laporanEksekusi
    const updated = await prisma.jadwalProduksi.update({
      where: { id },
      data: {
        statusJadwal: 'SELESAI',
        laporanEksekusi: laporanEksekusi,
      }
    });

    // 3. Tambahkan Stok ke ProdukGudang dan KonfigurasiKemasan
    if (laporanEksekusi && Array.isArray(laporanEksekusi)) {
      for (const lap of laporanEksekusi) {
        if (lap.lolosSop && lap.hasilKemasan && lap.hasilKemasan.totalKg > 0) {
          // Cari produk gudang
          let produk = await prisma.produkGudang.findFirst({
            where: { gudangId: jadwal.gudangId, nama: { contains: lap.nama, mode: 'insensitive' } }
          });

          // Buat jika tidak ada
          if (!produk) {
            const master = await prisma.masterKomoditas.findFirst({ 
              where: { nama: { contains: lap.nama, mode: 'insensitive' } }
            });
            produk = await prisma.produkGudang.create({
              data: {
                gudangId: jadwal.gudangId,
                nama: master?.nama || lap.nama,
                masterKomoditasId: master?.id,
                hargaGudang: master?.harga || 0,
                stok: 0,
                satuan: 'kg',
              }
            });
          }

          // Kurangi stok curah (bulk) sesuai bahan baku yang dipakai
          const bahanDipakai = parseFloat(lap.targetVolumeKg) || 0;
          const currentStok = produk.stok || 0;
          const newStok = Math.max(0, currentStok - bahanDipakai);
          
          await prisma.produkGudang.update({
            where: { id: produk.id },
            data: { stok: newStok }
          });

          // Update stok per kemasan
          const upsertKemasan = async (ukuran: number, qty: number) => {
            const intQty = Math.round(qty);
            if (intQty > 0) {
              await prisma.konfigurasiKemasan.upsert({
                where: { produkGudangId_ukuranKg: { produkGudangId: produk!.id, ukuranKg: ukuran } },
                update: { stokKemasan: { increment: intQty } },
                create: { produkGudangId: produk!.id, ukuranKg: ukuran, stokKemasan: intQty }
              });
            }
          };

          const k1 = parseFloat(lap.hasilKemasan.kemasan1kg) || 0;
          const k25 = parseFloat(lap.hasilKemasan.kemasan2_5kg) || 0;
          const cp = parseFloat(lap.hasilKemasan.customPack) || 0;
          const cs = parseFloat(lap.hasilKemasan.customSize) || 0;

          await upsertKemasan(1, k1);
          await upsertKemasan(2.5, k25);
          if (cp > 0 && cs > 0) {
            await upsertKemasan(cs, cp);
          }

          // Sinkronisasi Harga Jual dan HPP ke Database (dan otomatis ke Agro Market E-commerce)
          if (lap.hppDetail) {
            const outputKg = Number(lap.hppDetail.outputKg) || 1;
            const hppData = {
              gudangId: jadwal.gudangId,
              hargaBeliPetani: Number(lap.hppDetail.bahanBaku) / outputKg || 0,
              biayaSortir: Number(lap.hppDetail.tenagaKerja) / outputKg || 0,
              biayaGrading: 0,
              biayaPengemasan: Number(lap.hppDetail.kemasan) / outputKg || 0,
              biayaOverhead: Number(lap.hppDetail.overhead) / outputKg || 0,
              biayaLainnya: Number(lap.hppDetail.bahanLain) / outputKg || 0,
              totalHpp: Number(lap.hppDetail.hppPerKg) || 0,
              hargaJual: Number(lap.hppDetail.hargaJual) || 0,
              marginRp: Number(lap.hppDetail.marginRp) || 0,
              marginPersen: Number(lap.hppDetail.marginPersen) || 0,
              catatan: "Diupdate dari hasil pemrosesan sortir",
            };

            await prisma.$transaction([
              prisma.hppProduk.upsert({
                where: { produkGudangId: produk.id },
                create: { produkGudangId: produk.id, ...hppData },
                update: hppData,
              }),
              prisma.produkGudang.update({
                where: { id: produk.id },
                data: { hargaGudang: hppData.hargaJual }
              })
            ]);
          }
        }
      }
    }

    return res.json({ statusCode: 200, data: updated, message: 'Eksekusi Produksi Berhasil!' });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── GET /api/jadwal-produksi/kapasitas ────────────────────────────────────
// Cek kapasitas tersedia di tanggal tertentu
export const getKapasitasTanggal = async (req: Request, res: Response) => {
  try {
    const { tanggal, kapasitasHarianKg } = req.query;

    if (!tanggal) return res.status(400).json({ error: 'tanggal wajib diisi (YYYY-MM-DD)' });

    const tgl = new Date(String(tanggal) + 'T00:00:00.000Z');
    const tglEnd = new Date(String(tanggal) + 'T23:59:59.999Z');
    const kapasitas = kapasitasHarianKg ? parseFloat(String(kapasitasHarianKg)) : 1000;

    const hariTerjadwal = await prisma.hariProduksi.findMany({
      where: {
        tanggal: { gte: tgl, lt: tglEnd },
        statusHari: { not: 'SELESAI' },
      },
      include: { jadwal: { select: { komoditasNama: true, statusJadwal: true } } },
    });

    const totalTerjadwal = hariTerjadwal.reduce((s, h) => s + h.targetKg, 0);
    const sisaKapasitas = Math.max(0, kapasitas - totalTerjadwal);

    return res.json({
      statusCode: 200,
      data: {
        tanggal: String(tanggal),
        kapasitasTotal: kapasitas,
        kapasitasTerpakai: totalTerjadwal,
        kapasitasTersedia: sisaKapasitas,
        jadwalAktif: hariTerjadwal,
      },
    });
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

// ─── GET /api/jadwal-produksi/demand-pool ────────────────────────────────────────
// Mengambil rekapitulasi kebutuhan stok dari semua order yang belum terpenuhi
export const getProductionDemandPool = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user?.peran === 'SUPER_ADMIN';
    const managedWarehouseIds = req.user?.managedWarehouses || [];

    const poolMap = new Map<string, { produkNama: string; ukuranKg: number | string; totalPackKurang: number; totalKgKurang: number; keteranganTambahan?: string; estimasiBahanBakuRp?: number; requests: { id: string, ecommerceId: string | null, tanggal: Date, expired: Date }[] }>();

    // --- AMBIL SEMUA PERMINTAAN PENGADAAN (DARI PETANI) YANG SUDAH TIBA/QC ---
    const manualRequests = await prisma.permintaanPengadaan.findMany({
      where: {
        gudangId: !isSuperAdmin ? { in: managedWarehouseIds } : undefined,
        status: { in: ['TIBA', 'SELESAI_QC', 'TERPENUHI', 'SEBAGIAN_TERPENUHI', 'DALAM_PENGANTARAN'] }
      },
      include: { gudang: true }
    });

    const jadwalList = await prisma.jadwalProduksi.findMany({
      select: { permintaanPengadaanId: true, detailKomoditas: true }
    });
    const scheduledIds: string[] = [];
    for (const j of jadwalList) {
      if (j.permintaanPengadaanId) {
        scheduledIds.push(j.permintaanPengadaanId);
      }
      if (j.detailKomoditas && Array.isArray(j.detailKomoditas)) {
        const details = j.detailKomoditas as any[];
        for (const item of details) {
          if (item && typeof item === 'object') {
            if (item.permintaanId) {
              scheduledIds.push(String(item.permintaanId));
            }
            if (item.permintaanPengadaanId) {
              scheduledIds.push(String(item.permintaanPengadaanId));
            }
            if (Array.isArray(item.permintaanIds)) {
              scheduledIds.push(...item.permintaanIds.map(String));
            }
          }
        }
      }
    }

    // Ambil stok gudang saat ini untuk membatasi (capping) demand pool manual
    // agar tidak menampilkan order lama yang fisiknya sudah diproses/hilang.
    const stokGudang = await prisma.produkGudang.findMany({
      where: !isSuperAdmin ? { gudangId: { in: managedWarehouseIds } } : {}
    });
    
    // Kelompokkan manual requests yang belum terjadwal per komoditas dan kemasan
    const manualSums = new Map<string, number>();
    const reqsPerKomoditas = new Map<string, typeof manualRequests>();
    
    const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };

    for (const req of manualRequests) {
      if (scheduledIds.includes(req.id)) continue;
      
      let targetNet = 0;
      // Coba ekstrak target bersih (Net) dari catatan (misal: "Target Produksi: 204kg")
      if (req.catatan && req.catatan.includes('Target Produksi:')) {
        const match = req.catatan.match(/Target Produksi:\s*(\d+(\.\d+)?)kg/i);
        if (match && match[1]) {
          targetNet = parseFloat(match[1]);
        }
      }
      
      // Jika tidak ada di catatan, hitung mundur (Net = Gross * (1 - loss))
      if (!targetNet) {
        const loss = YIELD_LOSS_MAP[req.komoditasNama] || 0;
        targetNet = Math.round((req.targetKg || 0) * (1 - (loss / 100)));
      }

      // Extract kemasan from rencanaProduksi
      let kemasanStr = '0';
      if (req.rencanaProduksi && typeof req.rencanaProduksi === 'object' && !Array.isArray(req.rencanaProduksi)) {
        kemasanStr = (req.rencanaProduksi as any).kemasan || '0';
      }
      
      const groupKey = `${req.komoditasNama}_${kemasanStr}`;

      manualSums.set(groupKey, (manualSums.get(groupKey) || 0) + targetNet);
      
      if (!reqsPerKomoditas.has(groupKey)) {
        reqsPerKomoditas.set(groupKey, []);
      }
      reqsPerKomoditas.get(groupKey)!.push(req);
    }

    for (const [groupKey, requests] of reqsPerKomoditas.entries()) {
      const parts = groupKey.split('_');
      const komoditas = parts[0];
      const kemasanVal = parts[1];
      
      const stokProduk = stokGudang.find(s => s.nama === komoditas && (!isSuperAdmin ? managedWarehouseIds.includes(s.gudangId) : true));
      const stokAktualGross = stokProduk?.stok || 0;
      
      const loss = YIELD_LOSS_MAP[komoditas] || 0;
      const stokAktualNet = Math.round(stokAktualGross * (1 - (loss / 100)));
      
      const demandAwalNet = manualSums.get(groupKey) || 0;
      
      // Batasi demand net maksimal sejumlah stok net yang bisa dihasilkan dari fisik curah saat ini
      const finalDemandNet = Math.min(demandAwalNet, stokAktualNet);
      
      if (finalDemandNet <= 0) continue; // Skip jika stok fisik sudah habis (berarti order lama sudah diproses tanpa jadwal)

      const key = `${komoditas}_MANUAL_${kemasanVal}`;
      if (!poolMap.has(key)) {
        poolMap.set(key, {
          produkNama: komoditas,
          ukuranKg: isNaN(Number(kemasanVal)) ? kemasanVal : Number(kemasanVal),
          totalPackKurang: 0,
          totalKgKurang: 0,
          keteranganTambahan: '',
          estimasiBahanBakuRp: 0,
          requests: []
        });
      }
      
      const entry = poolMap.get(key)!;
      entry.totalKgKurang += finalDemandNet;
      if (typeof entry.ukuranKg === 'number' && entry.ukuranKg > 0) {
        entry.totalPackKurang = Math.ceil(entry.totalKgKurang / entry.ukuranKg);
      } else if (kemasanVal === 'kombinasi') {
        let sumBesar = 0;
        let sumKecil = 0;
        for (const req of requests) {
           if (req.rencanaProduksi && typeof req.rencanaProduksi === 'object' && !Array.isArray(req.rencanaProduksi)) {
              sumBesar += Number((req.rencanaProduksi as any).kemasanKombinasiBesar) || 0;
              sumKecil += Number((req.rencanaProduksi as any).kemasanKombinasiKecil) || 0;
           }
        }
        
        // Simpan nilai untuk dikirim ke frontend
        (entry as any).totalKemasanBesar = sumBesar;
        (entry as any).totalKemasanKecil = sumKecil;
        
        if (sumBesar > 0 || sumKecil > 0) {
           const parts = [];
           if (sumBesar > 0) parts.push(`2.5kg: ${sumBesar} pack`);
           if (sumKecil > 0) parts.push(`1kg: ${sumKecil} pack`);
           entry.keteranganTambahan = parts.join(' | ');
        }
      }
      
      for (const req of requests) {
        // Hitung estimasi bahan baku: (targetKg * hargaAcuanPerKg)
        if (req.hargaAcuanPerKg && req.targetKg) {
          entry.estimasiBahanBakuRp = (entry.estimasiBahanBakuRp || 0) + (req.targetKg * req.hargaAcuanPerKg);
        }

        if (!entry.requests.some(r => r.id === req.id)) {
          const baseDate = (req as any).tanggalTiba ? new Date((req as any).tanggalTiba) : (req.createdAt || new Date());
          entry.requests.push({
            id: req.id,
            ecommerceId: req.nomorOrder ? req.nomorOrder.replace('ORD-', 'MANUAL-') : 'MANUAL',
            // @ts-ignore
            tanggal: req.createdAt || new Date(),
            expired: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000)
          });
        }
      }
    }


    const demandPool = Array.from(poolMap.values()).sort((a, b) => a.produkNama.localeCompare(b.produkNama));

    return res.status(200).json({
      statusCode: 200,
      message: 'Berhasil mengambil kolam kebutuhan produksi',
      data: demandPool,
    });
  } catch (error: unknown) {
    console.error('Error fetching demand pool:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Terjadi kesalahan internal server',
      error: (error as Error).message,
    });
  }
};

export const cancelDemand = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, type } = req.body;

    if (!id || !type) {
      return res.status(400).json({ error: 'id dan type (STORE/MANUAL) wajib diisi' });
    }

    if (type === 'STORE') {
      await prisma.pengajuanStokToko.update({
        where: { id },
        data: { status: 'DITOLAK' },
      });
      return res.status(200).json({ statusCode: 200, message: 'Berhasil membatalkan/menolak pengajuan stok toko' });
    } else if (type === 'MANUAL') {
      await prisma.permintaanPengadaan.update({
        where: { id },
        data: { status: 'DIBATALKAN' },
      });
      return res.status(200).json({ statusCode: 200, message: 'Berhasil membatalkan permintaan pengadaan manual' });
    } else {
      return res.status(400).json({ error: 'Type tidak valid, harus STORE atau MANUAL' });
    }
  } catch (error: unknown) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

