import { Request, Response } from 'express';
import { PrismaClient, StatusPermintaanPengadaan } from '@prisma/client';

const prisma = new PrismaClient();

export const updateStatusTracking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(StatusPermintaanPengadaan).includes(status)) {
      return res.status(400).json({ error: 'Status tidak valid' });
    }

    const dataToUpdate: any = { status };
    if (status === 'TIBA') {
      dataToUpdate.tanggalTiba = new Date();
    }

    const updated = await prisma.permintaanPengadaan.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({ message: 'Status berhasil diperbarui', data: updated });
  } catch (error: any) {
    console.error('updateStatusTracking error:', error);
    res.status(500).json({ error: 'Gagal memperbarui status' });
  }
};
