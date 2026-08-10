import { Response } from 'express';
import prisma from '../../prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const allocateStockRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const request = await prisma.pengajuanStokToko.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            kemasanDetail: true
          }
        }
      },
    });

    if (!request) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Pengajuan stok tidak ditemukan',
      });
    }

    if (request.status !== 'DIAJUKAN' && request.status !== 'MENUNGGU_SEBAGIAN') {
      return res.status(400).json({
        statusCode: 400,
        message: `Order ini sudah berstatus ${request.status} dan tidak bisa dialokasikan ulang.`
      });
    }

    let isAllFulfilled = true;

    // Use a transaction to ensure atomic reservations
    await prisma.$transaction(async (tx) => {
      for (const item of request.items) {
        let produkGudang = null;
        if (item.produkId) {
          produkGudang = await tx.produkGudang.findFirst({
            where: { id: item.produkId, gudangId: request.gudangId },
            include: { kemasan: true },
          });
        }
        if (!produkGudang && item.produkNama) {
          produkGudang = await tx.produkGudang.findFirst({
            where: {
              gudangId: request.gudangId,
              nama: { equals: item.produkNama, mode: 'insensitive' },
            },
            include: { kemasan: true },
          });
        }

        if (!produkGudang) {
          isAllFulfilled = false;
          continue;
        }

        const kemasanDetailList = item.kemasanDetail && item.kemasanDetail.length > 0 
          ? item.kemasanDetail 
          : item.ukuranKemasanKg && item.jumlahKemasan ? [
              {
                id: 'dummy',
                ukuranKg: item.ukuranKemasanKg,
                jumlahKemasan: item.jumlahKemasan,
                // If it's a dummy, we don't have a specific pack reservation counter for it in DB yet,
                // but we can estimate based on item.jumlahDireservasi (which is in Kg).
                // Or better, we assume 0 because if it's dummy it hasn't been partially reserved per-pack.
                // Wait, if it was partially reserved before this fix, it might be messy.
                // Let's assume (item.jumlahDireservasi / item.ukuranKemasanKg) packs are reserved.
                jumlahDireservasi: item.jumlahDireservasi ? Math.floor(item.jumlahDireservasi / item.ukuranKemasanKg) : 0
              }
            ] : [];

        let totalDireservasiKg = 0;
        let itemFullyReserved = true;

        if (kemasanDetailList.length > 0) {
          for (const pkg of kemasanDetailList) {
            const qtyNeeded = pkg.jumlahKemasan - (pkg.jumlahDireservasi || 0);
            if (qtyNeeded <= 0) continue; // Already fully reserved

            const config = produkGudang.kemasan.find((k: any) => Math.abs(Number(k.ukuranKg) - Number(pkg.ukuranKg)) < 0.01);
            if (!config) {
              itemFullyReserved = false;
              continue;
            }

            const availablePacks = config.stokKemasan - (config.stokKemasanReserved || 0);
            const toReserve = Math.min(qtyNeeded, Math.max(0, availablePacks));

            if (toReserve > 0) {
              // Update KonfigurasiKemasan
              await tx.konfigurasiKemasan.update({
                where: { id: config.id },
                data: { stokKemasanReserved: { increment: toReserve } }
              });

              // Update ItemPengajuanStokKemasan only if it's not our dummy
              if (pkg.id !== 'dummy') {
                await tx.itemPengajuanStokKemasan.update({
                  where: { id: pkg.id },
                  data: { jumlahDireservasi: { increment: toReserve } }
                });
              }

              totalDireservasiKg += toReserve * pkg.ukuranKg;
            }

            if (toReserve < qtyNeeded) {
              itemFullyReserved = false;
            }
          }
        } else {
          // Bulk allocation without specific packaging
          const qtyNeeded = item.jumlahPermintaan - (item.jumlahDireservasi || 0);
          if (qtyNeeded > 0) {
            const availableBulk = produkGudang.stok - (produkGudang.stokReserved || 0);
            const toReserve = Math.min(qtyNeeded, Math.max(0, availableBulk));

            if (toReserve > 0) {
              totalDireservasiKg += toReserve;
            }

            if (toReserve < qtyNeeded) {
              itemFullyReserved = false;
            }
          }
        }

        if (totalDireservasiKg > 0) {
          // Update bulk reserved
          await tx.produkGudang.update({
            where: { id: produkGudang.id },
            data: { stokReserved: { increment: totalDireservasiKg } }
          });

          await tx.itemPengajuanStok.update({
            where: { id: item.id },
            data: { jumlahDireservasi: { increment: totalDireservasiKg } }
          });
        }

        if (!itemFullyReserved) {
          isAllFulfilled = false;
        }
      }

      // Update Order Status
      const finalStatus = isAllFulfilled ? 'DIPROSES' : 'MENUNGGU_SEBAGIAN';
      
      await tx.pengajuanStokToko.update({
        where: { id },
        data: { status: finalStatus }
      });
    });

    return res.status(200).json({
      statusCode: 200,
      message: isAllFulfilled 
        ? 'Alokasi stok berhasil sepenuhnya. Order sekarang berstatus DIPROSES.' 
        : 'Alokasi stok dilakukan sebagian. Order menunggu sisa stok atau produksi (MENUNGGU_SEBAGIAN).',
      status: isAllFulfilled ? 'DIPROSES' : 'MENUNGGU_SEBAGIAN'
    });
  } catch (error: unknown) {
    console.error('Error allocating stock:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Terjadi kesalahan internal server',
      error: (error as Error).message,
    });
  }
};
