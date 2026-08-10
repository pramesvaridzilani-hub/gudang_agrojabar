import re

file_path = 'd:/warehouse/warehouse/backend/src/controllers/pengajuan/update-stock-request-status.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """          if (produkGudang) {
            const kemasanDetailList = item.kemasanDetail || [];"""

new_block = """          if (produkGudang) {
            const kemasanDetailList = item.kemasanDetail && item.kemasanDetail.length > 0
              ? item.kemasanDetail
              : item.ukuranKemasanKg && item.jumlahKemasan ? [
                  {
                    id: 'dummy',
                    ukuranKg: item.ukuranKemasanKg,
                    jumlahKemasan: item.jumlahKemasan,
                    jumlahDireservasi: item.jumlahDireservasi || 0
                  }
                ] : [];"""

content = content.replace(old_block, new_block)

old_reset_block = """              // Reset item's own reservation
              await prisma.itemPengajuanStokKemasan.update({
                where: { id: pkg.id },
                data: { jumlahDireservasi: 0 }
              });"""

new_reset_block = """              // Reset item's own reservation
              if (pkg.id === 'dummy') {
                await prisma.itemPengajuanStok.update({
                  where: { id: item.id },
                  data: { jumlahDireservasi: 0 }
                });
              } else {
                await prisma.itemPengajuanStokKemasan.update({
                  where: { id: pkg.id },
                  data: { jumlahDireservasi: 0 }
                });
              }"""

content = content.replace(old_reset_block, new_reset_block)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
