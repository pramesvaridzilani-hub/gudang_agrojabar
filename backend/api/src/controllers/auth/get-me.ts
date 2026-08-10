import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Pengguna tidak terautentikasi',
      });
    }

    // Fetch fresh details with warehouses
    const user = await prisma.pengguna.findUnique({
      where: { id: req.user.id },
      include: {
        managedWarehouses: {
          select: {
            id: true,
            kode: true,
            nama: true,
            alamat: true,
            tipe: true,
            kapasitasKg: true,
            kapasitasTerpakai: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Pengguna tidak ditemukan',
      });
    }

    let managedWarehouses = user.managedWarehouses;
    if (user.peran === 'STAF_GUDANG') {
      managedWarehouses = await prisma.gudang.findMany({
        select: {
          id: true,
          kode: true,
          nama: true,
          alamat: true,
          tipe: true,
          kapasitasKg: true,
          kapasitasTerpakai: true,
          status: true,
        },
      }) as any;
    }

    return res.status(200).json({
      statusCode: 200,
      message: 'OK',
      data: {
        user: {
          id: user.id,
          email: user.email,
          nama: user.nama,
          noTelepon: user.noTelepon,
          peran: user.peran,
          managedWarehouses: managedWarehouses,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Terjadi kesalahan internal server',
      error: (error as Error).message,
    });
  }
};
