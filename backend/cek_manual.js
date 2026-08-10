const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const manualRequests = await prisma.permintaanPengadaan.findMany({
    where: {
      tipePesanan: 'MANUAL',
      status: { in: ['TIBA', 'SELESAI_QC', 'TERPENUHI', 'SEBAGIAN_TERPENUHI', 'DALAM_PENGANTARAN'] }
    },
    include: { items: true }
  });
  
  console.log(JSON.stringify(manualRequests, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
