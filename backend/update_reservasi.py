import re

file_path = 'd:/warehouse/warehouse/backend/src/controllers/jadwal-produksi.controller.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """      include: {
        hariProduksi: { orderBy: { hariKe: 'asc' } },
      },
    });

    return res.status(201).json({ statusCode: 201, data: jadwal });"""

new_logic = """      include: {
        hariProduksi: { orderBy: { hariKe: 'asc' } },
      },
    });

    // --- AUTO-RESERVASI DEMAND POOL ---
    if (detailKomoditas && Array.isArray(detailKomoditas)) {
      const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
      const requiredPacks: { nama: string; ukuranKg: number; pack: number }[] = [];

      for (const item of detailKomoditas) {
        const rawVolume = parseFloat(item.volumeKg) || 0;
        const loss = YIELD_LOSS_MAP[item.nama] || 0;
        const penyusutanKg = rawVolume * (loss / 100);
        const hasilJadiKg = Math.round(Math.max(0, rawVolume - penyusutanKg));

        if (item.kemasan === 'kombinasi') {
          const jumlahBesar = parseInt(item.kemasanKombinasiBesar) || 0;
          const sisa = Math.max(0, hasilJadiKg - (jumlahBesar * 2.5));
          const jumlahKecil = Math.floor(sisa / 1);
          if (jumlahBesar > 0) requiredPacks.push({ nama: item.nama, ukuranKg: 2.5, pack: jumlahBesar });
          if (jumlahKecil > 0) requiredPacks.push({ nama: item.nama, ukuranKg: 1, pack: jumlahKecil });
        } else {
          const ukuranKemasan = item.kemasan === 'kustom' ? (parseFloat(item.kemasanKustom) || 1) : parseFloat(item.kemasan);
          const estimasiKemasan = hasilJadiKg > 0 && ukuranKemasan > 0 ? Math.floor(hasilJadiKg / ukuranKemasan) : 0;
          if (estimasiKemasan > 0) {
            requiredPacks.push({ nama: item.nama, ukuranKg: ukuranKemasan, pack: estimasiKemasan });
          }
        }
      }

      for (const reqPack of requiredPacks) {
        let sisaDibutuhkan = reqPack.pack;
        if (sisaDibutuhkan <= 0) continue;

        const openPengajuan = await prisma.pengajuanStokToko.findMany({
          where: {
            status: { in: ['DIAJUKAN', 'MENUNGGU_SEBAGIAN'] },
          },
          orderBy: { createdAt: 'asc' }, // FIFO
          include: { items: { include: { kemasanDetail: true } } }
        });

        for (const pengajuan of openPengajuan) {
          if (sisaDibutuhkan <= 0) break;
          const targetItem = pengajuan.items.find((i: any) => i.produkNama === reqPack.nama);
          if (!targetItem) continue;

          if (targetItem.kemasanDetail && targetItem.kemasanDetail.length > 0) {
            const detail = targetItem.kemasanDetail.find((d: any) => d.ukuranKg === reqPack.ukuranKg);
            if (detail) {
              const maxBisaDireservasi = detail.jumlahKemasan - (detail.jumlahDireservasi || 0);
              if (maxBisaDireservasi > 0) {
                const ambil = Math.min(sisaDibutuhkan, maxBisaDireservasi);
                await prisma.itemPengajuanStokKemasan.update({
                  where: { id: detail.id },
                  data: { jumlahDireservasi: (detail.jumlahDireservasi || 0) + ambil }
                });
                sisaDibutuhkan -= ambil;
              }
            }
          } else if (targetItem.ukuranKemasanKg === reqPack.ukuranKg) {
            const maxBisaDireservasi = (targetItem.jumlahKemasan || 0) - (targetItem.jumlahDireservasi || 0);
            if (maxBisaDireservasi > 0) {
              const ambil = Math.min(sisaDibutuhkan, maxBisaDireservasi);
              await prisma.itemPengajuanStok.update({
                where: { id: targetItem.id },
                data: { jumlahDireservasi: (targetItem.jumlahDireservasi || 0) + ambil }
              });
              sisaDibutuhkan -= ambil;
            }
          }
        }
      }
    }
    // ----------------------------------

    return res.status(201).json({ statusCode: 201, data: jadwal });"""

content = content.replace(old_logic, new_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
