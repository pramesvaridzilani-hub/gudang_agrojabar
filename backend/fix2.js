const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const reqId = '6152b6c0-eeb5-45d1-9e80-945e19a8a578';
  console.log('Fixing request', reqId);
  const items = await prisma.itemPengajuanStok.findMany({
    where: { pengajuanId: reqId },
    include: { kemasanDetail: true }
  });

  for (const item of items) {
    const produkGudang = await prisma.produkGudang.findFirst({
      where: { id: item.produkId },
      include: { kemasan: true }
    });
    if (!produkGudang) continue;

    const details = item.kemasanDetail && item.kemasanDetail.length > 0
      ? item.kemasanDetail
      : item.ukuranKemasanKg && item.jumlahKemasan ? [
          {
            id: 'dummy',
            ukuranKg: item.ukuranKemasanKg,
            jumlahKemasan: item.jumlahKemasan,
            jumlahDireservasi: item.jumlahDireservasi || 0
          }
        ] : [];

    for (const pkg of details) {
      if (pkg.jumlahKemasan <= 0) continue;
      
      const config = produkGudang.kemasan.find(k => k.ukuranKg === pkg.ukuranKg);
      if (config) {
        await prisma.konfigurasiKemasan.update({
          where: { id: config.id },
          data: {
            stokKemasan: { decrement: pkg.jumlahKemasan },
            stokKemasanReserved: { decrement: pkg.jumlahDireservasi || 0 }
          }
        });
        console.log(`Deducted ${pkg.jumlahKemasan} packs of ${pkg.ukuranKg}kg (and ${pkg.jumlahDireservasi} reserved) for ${produkGudang.nama}`);
      }
      
      if (pkg.id === 'dummy') {
        // Reset the item's own reservation
        await prisma.itemPengajuanStok.update({
          where: { id: item.id },
          data: { jumlahDireservasi: 0 }
        });
      } else {
        await prisma.itemPengajuanStokKemasan.update({
          where: { id: pkg.id },
          data: { jumlahDireservasi: 0 }
        });
      }
    }
    
    // Also reset any bulk reservation if it fell through
    if (details.length === 0) {
      await prisma.produkGudang.update({
        where: { id: produkGudang.id },
        data: {
          stok: { decrement: item.jumlahPermintaan },
          stokReserved: { decrement: item.jumlahDireservasi || 0 }
        }
      });
      await prisma.itemPengajuanStok.update({
        where: { id: item.id },
        data: { jumlahDireservasi: 0 }
      });
      console.log(`Deducted ${item.jumlahPermintaan} kg bulk for ${produkGudang.nama}`);
    }
  }
}

fix().then(() => prisma.$disconnect());
