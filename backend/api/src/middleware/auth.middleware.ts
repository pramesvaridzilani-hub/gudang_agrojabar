import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    nama: string | null;
    peran: string;
    managedWarehouses: string[];
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Akses ditolak: Token tidak ditemukan atau format salah',
      });
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'gudang-fullstack-independent-super-secret-key-2026'
    ) as { id: string; email: string; peran: string };

    // Fetch user from DB to verify existence and get latest role / managed warehouses
    const user = await prisma.pengguna.findUnique({
      where: { id: decoded.id },
      include: {
        managedWarehouses: {
          select: { id: true }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        statusCode: 401,
        message: 'Akses ditolak: Pengguna tidak terdaftar',
      });
    }

    let warehouseIds = user.managedWarehouses.map((w) => w.id);
    if (user.peran === 'STAF_GUDANG') {
      const allWarehouses = await prisma.gudang.findMany({ select: { id: true } });
      warehouseIds = allWarehouses.map((w) => w.id);
    }

    req.user = {
      id: user.id,
      email: user.email,
      nama: user.nama,
      peran: user.peran,
      managedWarehouses: warehouseIds,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      statusCode: 401,
      message: 'Akses ditolak: Token tidak valid atau kadaluarsa',
    });
  }
};
