import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

// 2. Pack bulk product stock into packaged stock
export const kemaskanProduk = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { produkGudangId, ukuranKg, jumlahKemasan } = req.body;

    if (!produkGudangId || !ukuranKg || !jumlahKemasan) {
      return res.status(400).json({
        statusCode: 400,
        message: 'produkGudangId, ukuranKg, dan jumlahKemasan wajib diisi'
      });
    }

    if (ukuranKg <= 0 || jumlahKemasan <= 0) {
      return res.status(400).json({
        statusCode: 400,
        message: 'ukuranKg dan jumlahKemasan harus lebih besar dari 0'
      });
    }

    // Get product
    const produk = await prisma.produkGudang.findUnique({
      where: { id: produkGudangId }
    });

    if (!produk) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Produk gudang tidak ditemukan'
      });
    }

    const totalKgDibutuhkan = ukuranKg * jumlahKemasan;


    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.produkGudang.findUnique({
        where: { id: produkGudangId }
      });
      if (!p) throw new Error('Produk gudang tidak ditemukan');
      if (p.stok < totalKgDibutuhkan) throw new Error(`Stok sayur segar tidak cukup. Tersedia: ${p.stok}kg, dibutuhkan: ${totalKgDibutuhkan}kg`);

      // Deduct bulk stock and round it to 2 decimals
      const newStok = Math.round((p.stok - totalKgDibutuhkan) * 100) / 100;
      await tx.produkGudang.update({
        where: { id: produkGudangId },
        data: { stok: newStok }
      });

      // Find existing configuration for this specific pack size
      const existing = await tx.konfigurasiKemasan.findFirst({
        where: { produkGudangId, ukuranKg }
      });

      let updatedKemasan;
      if (existing) {
        updatedKemasan = await tx.konfigurasiKemasan.update({
          where: { id: existing.id },
          data: { stokKemasan: existing.stokKemasan + jumlahKemasan }
        });
      } else {
        updatedKemasan = await tx.konfigurasiKemasan.create({
          data: {
            produkGudangId,
            ukuranKg,
            stokKemasan: jumlahKemasan,
            isActive: true
          }
        });
      }

      // Record history for FROZEN (Tambah)
      await tx.riwayatPerubahanStok.create({
        data: {
          produkGudangId,
          gudangId: p.gudangId,
          penggunaId: req.user!.id,
          jenisStok: 'FROZEN',
          operasi: 'TAMBAH',
          jumlah: jumlahKemasan,
          ukuranKemasanKg: ukuranKg,
          stokSebelumnya: existing ? existing.stokKemasan : 0,
          stokSetelahnya: existing ? existing.stokKemasan + jumlahKemasan : jumlahKemasan,
          keterangan: `Pengemasan dari sayur segar (${totalKgDibutuhkan} kg)`,
        }
      });

      // Record history for SEGAR (Kurang)
      await tx.riwayatPerubahanStok.create({
        data: {
          produkGudangId,
          gudangId: p.gudangId,
          penggunaId: req.user!.id,
          jenisStok: 'SEGAR',
          operasi: 'KURANG',
          jumlah: totalKgDibutuhkan,
          stokSebelumnya: p.stok,
          stokSetelahnya: p.stok - totalKgDibutuhkan,
          keterangan: `Pengemasan produk ke ${jumlahKemasan} pack @${ukuranKg}kg`,
        }
      });

      return { updatedKemasan };
    });

    return res.status(200).json({
      statusCode: 200,
      message: `Berhasil mengemas ${jumlahKemasan} unit kemasan ukuran ${ukuranKg}kg (Total: ${totalKgDibutuhkan}kg)`,
      data: {
        kemasan: {
          id: result.updatedKemasan.id,
          ukuranKg: result.updatedKemasan.ukuranKg,
          stokKemasan: result.updatedKemasan.stokKemasan,
          totalKg: result.updatedKemasan.ukuranKg * result.updatedKemasan.stokKemasan
        }
      }
    });

  } catch (error: unknown) {
    console.error('Error packing product:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Terjadi kesalahan internal server saat pengemasan',
      error: (error as Error).message
    });
  }
};
