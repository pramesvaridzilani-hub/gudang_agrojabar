const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const manualReqs = await prisma.permintaanPengadaan.findMany({
    where: { tipePesanan: 'MANUAL' }
  });
  console.log("Manual Requests:", JSON.stringify(manualReqs, null, 2));

  const sellerReqs = await prisma.pengajuanStokToko.findMany({
    include: { items: true }
  });
  console.log("Seller Requests:", JSON.stringify(sellerReqs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
