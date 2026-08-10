import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const expirePermintaanPengadaan = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const permintaan = await prisma.permintaanPengadaan.findUnique({
      where: { id },
    });

    if (!permintaan) {
      return res.status(404).json({ error: 'Permintaan pengadaan tidak ditemukan.' });
    }

    if (permintaan.status === 'KADALUARSA' as any || permintaan.status === 'DIBATALKAN') {
      return res.status(400).json({ error: 'Permintaan sudah dalam status kadaluarsa atau dibatalkan.' });
    }

    const updated = await prisma.permintaanPengadaan.update({
      where: { id },
      data: { status: 'KADALUARSA' as any },
    });

    return res.status(200).json({
      message: 'Berhasil mengubah status permintaan pengadaan menjadi kadaluarsa.',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in expirePermintaanPengadaan:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat mencoba memproses expired.' });
  }
};
