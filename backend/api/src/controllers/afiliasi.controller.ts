import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const PETANI_API_URL = process.env.PETANI_API_URL || 'http://localhost:5000';

export async function listAfiliasiAdmin(req: Request, res: Response) {
  try {
    const { gudangId, status, role, search } = req.query;

    const where: any = {};
    if (gudangId) where.gudangId = gudangId;
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.petaniNama = { contains: String(search), mode: 'insensitive' };
    }

    const list = await prisma.afiliasi.findMany({
      where,
      include: {
        gudang: { select: { nama: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function getPetaniTersedia(req: Request, res: Response) {
  try {
    const { search } = req.query;
    // Panggil service Petani
    const response = await axios.get(`${PETANI_API_URL}/api/petani/list`, {
      params: { search }
    });
    res.json(response.data);
  } catch (error: any) {
    console.error('Failed to fetch from Petani service:', error.message);
    // Fallback: kembalikan array kosong jika service petani belum ada atau error
    res.json([]);
  }
}

export async function createAfiliasiManual(req: Request, res: Response) {
  try {
    const {
      petaniId,
      kepalaPetaniId,
      gudangId,
      petaniNama,
      petaniNik,
      noHp,
      role,
      status
    } = req.body;

    const newAfiliasi = await prisma.afiliasi.create({
      data: {
        petaniId,
        kepalaPetaniId,
        gudangId,
        petaniNama: petaniNama || 'Petani Tanpa Nama',
        petaniNik,
        noHp,
        role: role || 'petani',
        status: status || 'aktif',
      }
    });

    res.json(newAfiliasi);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Petani ini sudah terafiliasi dengan Gudang tersebut' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
}

export async function updateAfiliasi(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, noHp, kepalaPetaniId } = req.body;

    const updated = await prisma.afiliasi.update({
      where: { id },
      data: { status, noHp, kepalaPetaniId }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteAfiliasi(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.afiliasi.delete({ where: { id } });
    res.json({ message: 'Afiliasi berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
