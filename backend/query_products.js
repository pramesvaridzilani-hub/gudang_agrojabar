const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.produkGudang.findMany({
    include: { kemasan: true }
  });
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
