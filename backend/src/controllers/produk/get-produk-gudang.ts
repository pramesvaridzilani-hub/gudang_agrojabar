import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const getProdukGudang = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gudangId } = req.query;

    const whereClause: any = {};
    if (gudangId) {
      whereClause.gudangId = gudangId as string;
    } else if (req.user && req.user.peran !== 'SUPER_ADMIN') {
      // Non-super-admins only see products from warehouses they manage
      whereClause.gudangId = {
        in: req.user.managedWarehouses,
      };
    }

    const products = await prisma.produkGudang.findMany({
      where: whereClause,
      include: {
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
          },
        },
        masterKomoditas: {
          select: {
            id: true,
            nama: true,
            kategori: true,
            satuan: true,
            kodeKomoditasGlobal: true,
          },
        },
        kemasan: true,
        komposisi: {
          include: {
            masterKomoditas: {
              select: {
                id: true,
                nama: true,
                satuan: true,
              }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // --- FITUR TRACEABILITY: Ambil jadwal produksi AKTIF ---
    const gudangIds = Array.from(new Set(products.map(p => p.gudangId)));
    const jadwalAktif = await prisma.jadwalProduksi.findMany({
      where: {
        gudangId: { in: gudangIds },
        statusJadwal: 'AKTIF'
      },
      select: {
        id: true,
        komoditasNama: true,
        volumeTotalKg: true,
        tanggalMulai: true,
        tanggalSelesai: true,
      }
    });

    const productsWithBooking = products.map(p => {
      const pJadwal = jadwalAktif.filter(j => j.komoditasNama === p.nama);
      const totalBooked = pJadwal.reduce((acc, curr) => acc + curr.volumeTotalKg, 0);
      return {
        ...p,
        jadwalAktif: pJadwal,
        stokBooked: totalBooked
      };
    });
    // ---------------------------------------------------------

    return res.status(200).json({
      statusCode: 200,
      message: 'OK',
      data: productsWithBooking,
    });
  } catch (error: unknown) {
    console.error('Error fetching warehouse products:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Terjadi kesalahan internal server',
      error: (error as Error).message,
    });
  }
};
