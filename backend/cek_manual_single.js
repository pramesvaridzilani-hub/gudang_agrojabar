const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() { 
  const req = await prisma.permintaanPengadaan.findFirst({ 
    where: { 
      tipePesanan: 'MANUAL', 
      status: { in: ['TIBA', 'SELESAI_QC', 'TERPENUHI', 'SEBAGIAN_TERPENUHI', 'DALAM_PENGANTARAN'] } 
    } 
  }); 
  console.log(JSON.stringify(req, null, 2)); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
