const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const data = await prisma.pengajuanStok.findFirst({
    include: { items: { include: { masterProduk: true } } }
  });
  console.log(JSON.stringify(data, null, 2));
}
check().finally(() => prisma.$disconnect());
