import { Request, Response } from 'express';
import { PrismaClient, StatusPermintaanPengadaan } from '@prisma/client';

const prisma = new PrismaClient();

export const submitQc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nomorOrder,
      tanggal,
      komoditasNama,
      beratAktual,
      beratSesuai,
      beratTidakLolos,
      checklist,
      fotoQc,
    } = req.body;

    const permintaan = await prisma.permintaanPengadaan.findUnique({
      where: { id },
    });

    if (!permintaan) {
      return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
    }

    const updated = await prisma.permintaanPengadaan.update({
      where: { id },
      data: {
        status: StatusPermintaanPengadaan.SELESAI_QC,
        qcDetail: {
          nomorOrder,
          tanggal,
          komoditasNama,
          beratAktual,
          beratSesuai,
          beratTidakLolos,
          checklist,
          fotoQc,
        },
      },
    });

    // Otomatis masukkan stok ke ProdukGudang
    const beratMasuk = beratSesuai ? beratAktual : Math.max(0, beratAktual - beratTidakLolos);
    if (beratMasuk > 0) {
      const existingProduk = await prisma.produkGudang.findFirst({
        where: { gudangId: permintaan.gudangId, nama: komoditasNama },
      });

      if (existingProduk) {
        await prisma.produkGudang.update({
          where: { id: existingProduk.id },
          data: { stok: { increment: beratMasuk } },
        });
      } else {
        await prisma.produkGudang.create({
          data: {
            gudangId: permintaan.gudangId,
            nama: komoditasNama,
            hargaGudang: permintaan.hargaAcuanPerKg || 0,
            stok: beratMasuk,
            masterKomoditasId: permintaan.masterProdukId || null,
          },
        });
      }
    }

    res.json({ message: 'QC berhasil disubmit dan stok diperbarui', data: updated });
  } catch (error: any) {
    console.error('submitQc error:', error);
    res.status(500).json({ error: 'Gagal mensubmit QC' });
  }
};
