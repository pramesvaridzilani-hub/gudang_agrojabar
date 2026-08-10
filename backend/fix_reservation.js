const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Fix the buncis product
  const buncis = await prisma.produkGudang.findFirst({
    where: { nama: 'Buncis' },
    include: { kemasan: true }
  });
  
  if (buncis) {
    // Find how many actually requested and approved
    // Actually we know we need 300 booked for kemasan 1kg.
    const kemasan = buncis.kemasan.find(k => Number(k.ukuranKg) === 1);
    if (kemasan) {
      await prisma.konfigurasiKemasan.update({
        where: { id: kemasan.id },
        data: { stokKemasanReserved: 300 }
      });
      console.log('Fixed stokKemasanReserved for Buncis 1kg to 300');
    }
    
    // Stok reserved for bulk should be 0 because it's packed!
    await prisma.produkGudang.update({
      where: { id: buncis.id },
      data: { stokReserved: 0 }
    });
    console.log('Fixed stokReserved for Buncis to 0');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
