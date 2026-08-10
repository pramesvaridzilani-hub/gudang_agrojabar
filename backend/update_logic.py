import re

file_path = 'd:/warehouse/warehouse/backend/src/controllers/pengajuan/update-stock-request-status.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """    // Business Logic: Deduct warehouse stock if status transitions to DIPROSES
    if (status === 'DIPROSES' && request.status !== 'DIPROSES') {
      try {
        for (const item of updatedRequest.items) {
          const qtyToDeduct = item.jumlahDisetujui || item.jumlahPermintaan;
          
          // Find the source product in this warehouse
          const matchedUpdate = itemUpdates?.find((u: any) => u.itemId === item.id);
          const produkGudangId = matchedUpdate?.produkGudangId;

          let produkGudang = null;
          if (produkGudangId) {
            produkGudang = await prisma.produkGudang.findUnique({
              where: { id: produkGudangId },
              include: { kemasan: true }
            });
          } else if (item.produkId) {
            produkGudang = await prisma.produkGudang.findFirst({
              where: {
                id: item.produkId,
                gudangId: updatedRequest.gudangId,
              },
              include: { kemasan: true }
            });
          }

          if (!produkGudang && item.produkNama) {
            produkGudang = await prisma.produkGudang.findFirst({
              where: {
                gudangId: updatedRequest.gudangId,
                nama: {
                  equals: item.produkNama,
                  mode: 'insensitive',
                },
              },
              include: { kemasan: true }
            });
          }

          if (produkGudang) {
            const kemasanDetailList = item.kemasanDetail || [];
            
            // Deduct each package size
            for (const pkg of kemasanDetailList) {
              const ukuranKg = Number(pkg.ukuranKg);
              const jumlahKemasanReq = Number(pkg.jumlahKemasan);
              if (jumlahKemasanReq <= 0) continue;

              // Find in KonfigurasiKemasan
              const configKemasan = produkGudang.kemasan.find((k: any) => k.ukuranKg === ukuranKg);
              const stokKemasanTersedia = configKemasan ? configKemasan.stokKemasan : 0;

              if (stokKemasanTersedia >= jumlahKemasanReq) {
                // Case 1: Enough packed stock in KonfigurasiKemasan
                await prisma.konfigurasiKemasan.update({
                  where: { id: configKemasan!.id },
                  data: {
                    stokKemasan: {
                      decrement: jumlahKemasanReq
                    }
                  }
                });
                console.log(`[Stok Gudang] Fulfill ${jumlahKemasanReq} packs @ ${ukuranKg}kg directly from package stock of ${produkGudang.nama}`);
              } else {
                // Case 2: Not enough packed stock. Auto-pack from bulk!
                const deficit = jumlahKemasanReq - stokKemasanTersedia;
                const kgFromBulk = deficit * ukuranKg;

                // Deduct any remaining packed stock
                if (stokKemasanTersedia > 0) {
                  await prisma.konfigurasiKemasan.update({
                    where: { id: configKemasan!.id },
                    data: { stokKemasan: 0 }
                  });
                }

                // If KonfigurasiKemasan doesn't exist at all, we create/upsert it with 0
                if (!configKemasan) {
                  await prisma.konfigurasiKemasan.create({
                    data: {
                      produkGudangId: produkGudang.id,
                      ukuranKg: ukuranKg,
                      stokKemasan: 0,
                      isActive: true
                    }
                  });
                }

                // Deduct bulk stock
                await prisma.produkGudang.update({
                  where: { id: produkGudang.id },
                  data: {
                    stok: {
                      decrement: kgFromBulk
                    }
                  }
                });
                console.log(`[Stok Gudang] Auto-packaged ${deficit} packs @ ${ukuranKg}kg from bulk stock for ${produkGudang.nama}. Deducted ${kgFromBulk}kg from bulk.`);
              }
            }

            // Fallback: If no packaging details were specified at all, deduct from bulk stock directly
            if (kemasanDetailList.length === 0 && qtyToDeduct > 0) {
              await prisma.produkGudang.update({
                where: { id: produkGudang.id },
                data: {
                  stok: {
                    decrement: qtyToDeduct
                  }
                }
              });
              console.log(`[Stok Gudang] Fulfill ${qtyToDeduct}kg directly from bulk stock (no packaging breakdown specified) for ${produkGudang.nama}`);
            }
          } else {
            console.warn(`[Stok Gudang] Peringatan: Produk sumber untuk '${item.produkNama}' tidak ditemukan di Gudang ${updatedRequest.gudangId}. Stok tidak dikurangi.`);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to deduct warehouse stock:', (err as Error).message || err);
      }
    }"""

new_block = """    // Business Logic: Deduct physical stock AND clear reservations when status transitions to DIKIRIM or SELESAI
    const isNowCompleted = status === 'DIKIRIM' || status === 'SELESAI';
    const wasCompleted = request.status === 'DIKIRIM' || request.status === 'SELESAI';
    
    if (isNowCompleted && !wasCompleted) {
      try {
        for (const item of updatedRequest.items) {
          const qtyToDeduct = item.jumlahDisetujui || item.jumlahPermintaan;
          
          const matchedUpdate = itemUpdates?.find((u: any) => u.itemId === item.id);
          const produkGudangId = matchedUpdate?.produkGudangId;

          let produkGudang = null;
          if (produkGudangId) {
            produkGudang = await prisma.produkGudang.findUnique({ where: { id: produkGudangId }, include: { kemasan: true } });
          } else if (item.produkId) {
            produkGudang = await prisma.produkGudang.findFirst({ where: { id: item.produkId, gudangId: updatedRequest.gudangId }, include: { kemasan: true } });
          }
          if (!produkGudang && item.produkNama) {
            produkGudang = await prisma.produkGudang.findFirst({ where: { gudangId: updatedRequest.gudangId, nama: { equals: item.produkNama, mode: 'insensitive' } }, include: { kemasan: true } });
          }

          if (produkGudang) {
            const kemasanDetailList = item.kemasanDetail || [];
            
            // Deduct each package size
            for (const pkg of kemasanDetailList) {
              const ukuranKg = Number(pkg.ukuranKg);
              const jumlahKemasanReq = Number(pkg.jumlahKemasan);
              const reservedAmt = Number(pkg.jumlahDireservasi || 0);
              
              if (jumlahKemasanReq <= 0) continue;

              const configKemasan = produkGudang.kemasan.find((k: any) => k.ukuranKg === ukuranKg);
              const stokKemasanTersedia = configKemasan ? configKemasan.stokKemasan : 0;

              if (stokKemasanTersedia >= jumlahKemasanReq) {
                // Case 1: Enough packed stock
                await prisma.konfigurasiKemasan.update({
                  where: { id: configKemasan!.id },
                  data: {
                    stokKemasan: { decrement: jumlahKemasanReq },
                    stokKemasanReserved: { decrement: reservedAmt }
                  }
                });
                console.log(`[Stok Gudang] Fulfill ${jumlahKemasanReq} packs @ ${ukuranKg}kg directly from package stock of ${produkGudang.nama}`);
              } else {
                // Case 2: Not enough packed stock. Auto-pack from bulk!
                const deficit = jumlahKemasanReq - stokKemasanTersedia;
                const kgFromBulk = deficit * ukuranKg;

                if (configKemasan) {
                  await prisma.konfigurasiKemasan.update({
                    where: { id: configKemasan.id },
                    data: { 
                      stokKemasan: 0,
                      stokKemasanReserved: { decrement: reservedAmt }
                    }
                  });
                } else {
                  await prisma.konfigurasiKemasan.create({
                    data: {
                      produkGudangId: produkGudang.id,
                      ukuranKg: ukuranKg,
                      stokKemasan: 0,
                      stokKemasanReserved: 0,
                      isActive: true
                    }
                  });
                }

                // Deduct bulk stock
                await prisma.produkGudang.update({
                  where: { id: produkGudang.id },
                  data: {
                    stok: { decrement: kgFromBulk }
                  }
                });
                console.log(`[Stok Gudang] Auto-packaged ${deficit} packs @ ${ukuranKg}kg from bulk stock for ${produkGudang.nama}. Deducted ${kgFromBulk}kg from bulk.`);
              }

              // Reset item's own reservation
              await prisma.itemPengajuanStokKemasan.update({
                where: { id: pkg.id },
                data: { jumlahDireservasi: 0 }
              });
            }

            // Fallback: If no packaging details were specified at all, deduct from bulk stock directly
            if (kemasanDetailList.length === 0 && qtyToDeduct > 0) {
              const reservedBulk = Number(item.jumlahDireservasi || 0);
              await prisma.produkGudang.update({
                where: { id: produkGudang.id },
                data: {
                  stok: { decrement: qtyToDeduct },
                  stokReserved: { decrement: reservedBulk }
                }
              });
              
              await prisma.itemPengajuanStok.update({
                where: { id: item.id },
                data: { jumlahDireservasi: 0 }
              });
              console.log(`[Stok Gudang] Fulfill ${qtyToDeduct}kg directly from bulk stock (no packaging breakdown specified) for ${produkGudang.nama}`);
            }
          } else {
            console.warn(`[Stok Gudang] Peringatan: Produk sumber untuk '${item.produkNama}' tidak ditemukan di Gudang ${updatedRequest.gudangId}. Stok tidak dikurangi.`);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to deduct warehouse stock:', (err as Error).message || err);
      }
    }"""

content = content.replace(old_block, new_block)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
