const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const reqs = await prisma.pengajuanStokToko.findMany({ orderBy: { createdAt: 'desc' }, take: 2 });
  console.log(JSON.stringify(reqs, null, 2));
}
main();
