import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const createProdukGudang = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { gudangId, masterKomoditasId, nama, komposisi, isCampuran, hargaGudang, stok, deskripsi, gambarUrl, varianProduk, minimalPembelianKg } = req.body;

    // Validation
    if (!gudangId || hargaGudang === undefined) {
      return res.status(400).json({
        statusCode: 400,
        message: 'gudangId dan hargaGudang wajib diisi',
      });
    }

    if (!masterKomoditasId && (!isCampuran || !komposisi || komposisi.length === 0)) {
      return res.status(400).json({
        statusCode: 400,
        message: 'masterKomoditasId wajib diisi untuk produk tunggal, atau komposisi harus diisi untuk produk campuran',
      });
    }

    if (isCampuran && !nama) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Nama produk wajib diisi untuk produk campuran',
      });
    }

    // Authorization Check: Must manage this warehouse unless SUPER_ADMIN
    if (req.user && req.user.peran !== 'SUPER_ADMIN' && !req.user.managedWarehouses.includes(gudangId)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Akses ditolak: Anda tidak mengelola gudang ini',
      });
    }

    let masterKomoditas = null;
    let finalNama = nama;
    let finalSatuan = 'kg';

    if (masterKomoditasId) {
      // ✅ Fetch Master Komoditas
      masterKomoditas = await prisma.masterKomoditas.findUnique({
        where: { id: masterKomoditasId },
      });

      if (!masterKomoditas) {
        return res.status(404).json({
          statusCode: 404,
          message: 'Master Komoditas tidak ditemukan',
        });
      }

      if (!masterKomoditas.isActive) {
        return res.status(400).json({
          statusCode: 400,
          message: 'Master Komoditas tidak aktif',
        });
      }
      
      finalNama = masterKomoditas.nama;
      finalSatuan = masterKomoditas.satuan;
    }

    // Check if product already exists for this warehouse with the same varian (if not campuran)
    const varianVal = varianProduk ? String(varianProduk).trim() : null;

    // ✅ Validasi: varian harus berasal dari Master Varian aktif (jika diisi).
    // Kepala gudang hanya boleh memilih varian yang sudah disetujui admin.
    if (varianVal) {
      const masterVarian = await prisma.masterVarian.findFirst({
        where: { nama: varianVal, isActive: true },
      });
      if (!masterVarian) {
        return res.status(400).json({
          statusCode: 400,
          message: `Varian "${varianVal}" tidak terdaftar di Master Varian. Ajukan varian baru ke admin terlebih dahulu.`,
        });
      }
    }

    if (masterKomoditasId) {
      const existing = await prisma.produkGudang.findFirst({
        where: {
          gudangId,
          masterKomoditasId,
          varianProduk: varianVal ?? null,
        },
      });

      if (existing) {
        const namaLengkap = varianVal ? `${finalNama} ${varianVal}` : finalNama;
        return res.status(400).json({
          statusCode: 400,
          message: `Produk "${namaLengkap}" sudah ada di gudang ini`,
        });
      }
    }

    // ✅ Create product (tunggal atau campuran)
    const product = await prisma.produkGudang.create({
      data: {
        gudangId,
        masterKomoditasId: masterKomoditasId || null,
        nama: finalNama,
        varianProduk: varianVal,
        satuan: finalSatuan,
        hargaGudang: Number(hargaGudang),
        stok: Number(stok) || 0,
        minimalPembelianKg: minimalPembelianKg !== undefined ? Number(minimalPembelianKg) : 300,
        deskripsi: deskripsi || masterKomoditas?.deskripsi || '',
        gambarUrl: gambarUrl || masterKomoditas?.gambarUrl || null,
        isActive: true,
        ...(isCampuran && komposisi && komposisi.length > 0
          ? {
              komposisi: {
                create: komposisi.map((k: any) => ({
                  masterKomoditasId: k.masterKomoditasId,
                  jumlahKg: Number(k.jumlahKg),
                })),
              },
            }
          : {}),
      },
      include: {
        masterKomoditas: {
          select: {
            id: true,
            nama: true,
            kategori: true,
            satuan: true,
            harga: true,
            kodeKomoditasGlobal: true,
          },
        },
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
        }
      },
    });

    return res.status(201).json({
      statusCode: 201,
      message: 'Produk gudang berhasil dibuat',
      data: product,
    });
  } catch (error: unknown) {
    console.error('Error creating warehouse product:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Gagal membuat produk gudang',
      error: (error as Error).message,
    });
  }
};
