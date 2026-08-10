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

    if (produk.stok < totalKgDibutuhkan) {
      return res.status(400).json({
        statusCode: 400,
        message: `Stok sayur segar (bulk) tidak mencukupi. Tersedia ${produk.stok} kg, butuh ${totalKgDibutuhkan} kg.`
      });
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Kurangi stok bulk
      await tx.produkGudang.update({
        where: { id: produkGudangId },
        data: { stok: { decrement: totalKgDibutuhkan } }
      });

      // 2. Tambah stok kemasan yang spesifik ukuranKg
      const existingKemasan = await tx.konfigurasiKemasan.findFirst({
        where: { produkGudangId, ukuranKg }
      });

      let updatedKemasan;
      if (existingKemasan) {
        updatedKemasan = await tx.konfigurasiKemasan.update({
          where: { id: existingKemasan.id },
          data: { stokKemasan: { increment: jumlahKemasan } }
        });
      } else {
        updatedKemasan = await tx.konfigurasiKemasan.create({
          data: { produkGudangId, ukuranKg, stokKemasan: jumlahKemasan, isActive: true }
        });
      }
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
