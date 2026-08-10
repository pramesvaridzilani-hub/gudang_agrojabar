import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const getRiwayatStok = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { produkGudangId } = req.params;

    if (!produkGudangId) {
      return res.status(400).json({
        statusCode: 400,
        message: 'produkGudangId wajib diisi',
      });
    }

    const riwayat = await prisma.riwayatPerubahanStok.findMany({
      where: { produkGudangId },
      include: {
        pengguna: {
          select: {
            id: true,
            nama: true,
            email: true,
            peran: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      statusCode: 200,
      message: 'Berhasil mengambil riwayat stok',
      data: riwayat,
    });
  } catch (error: unknown) {
    console.error('Error fetching stock history:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Gagal mengambil riwayat stok',
      error: (error as Error).message,
    });
  }
};
