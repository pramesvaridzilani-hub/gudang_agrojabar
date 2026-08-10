const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fix() {
  const reqId = '6152b6c0-eeb5-45d1-9e80-945e19a8a578';
  console.log('Fixing request', reqId);
  const items = await prisma.itemPengajuanStok.findMany({
    where: { pengajuanId: reqId },
    include: { kemasanDetail: true }
  });
  console.log(JSON.stringify(items, null, 2));
}
fix().then(() => prisma.$disconnect());
