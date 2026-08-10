const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pendingRequests = await prisma.pengajuanStokToko.findMany({
    where: {
      status: { in: ['DIAJUKAN', 'MENUNGGU_SEBAGIAN'] }
    },
    include: {
      items: {
        include: {
          kemasanDetail: true
        }
      }
    }
  });
  
  console.log(JSON.stringify(pendingRequests, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
