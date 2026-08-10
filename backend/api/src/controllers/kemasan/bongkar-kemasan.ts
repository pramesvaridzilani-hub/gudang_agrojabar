import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

// 3. Unpack packaged product back to bulk stock
export const bongkarKemasan = async (req: AuthenticatedRequest, res: Response) => {
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

    const totalKgDikembalikan = ukuranKg * jumlahKemasan;

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const existingKemasan = await tx.konfigurasiKemasan.findFirst({
        where: { produkGudangId, ukuranKg }
      });

      if (!existingKemasan || existingKemasan.stokKemasan < jumlahKemasan) {
         throw new Error(`Stok kemasan ukuran ${ukuranKg}kg tidak mencukupi untuk dibongkar.`);
      }

      // 1. Kurangi stok kemasan spesifik
      const updatedKemasan = await tx.konfigurasiKemasan.update({
        where: { id: existingKemasan.id },
        data: { stokKemasan: { decrement: jumlahKemasan } }
      });

      // 2. Tambah stok bulk
      await tx.produkGudang.update({
        where: { id: produkGudangId },
        data: { stok: { increment: totalKgDikembalikan } }
      });

      return { updatedKemasan };
    });

    return res.status(200).json({
      statusCode: 200,
      message: `Berhasil menghapus ${totalKgDikembalikan}kg dari stok kemasan`,
      data: {
        kemasan: result.updatedKemasan ? {
          id: result.updatedKemasan.id,
          ukuranKg: result.updatedKemasan.ukuranKg,
          stokKemasan: result.updatedKemasan.stokKemasan,
          totalKg: result.updatedKemasan.ukuranKg * result.updatedKemasan.stokKemasan
        } : null
      }
    });

  } catch (error: unknown) {
    console.error('Error unpacking product:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Terjadi kesalahan internal server saat pembongkaran kemasan',
      error: (error as Error).message
    });
  }
};
