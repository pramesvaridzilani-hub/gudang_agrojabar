require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const request = await prisma.pengajuanStokToko.findUnique({
    where: { id: '0e6e2cc5-a615-4dd3-8f01-8d3e9062500a' },
    include: {
      items: {
        include: {
          kemasanDetail: true
        }
      }
    }
  });

  console.log("Current Status:", request.status);
  
  for (const item of request.items) {
    console.log("Item:", item.produkNama, item.produkId);
    console.log("ukuranKemasanKg:", item.ukuranKemasanKg, "jumlahKemasan:", item.jumlahKemasan);
    let kemasanDetailList = item.kemasanDetail || [];
    if (kemasanDetailList.length === 0 && item.ukuranKemasanKg && item.jumlahKemasan) {
      kemasanDetailList = [
        {
          ukuranKg: item.ukuranKemasanKg,
          jumlahKemasan: item.jumlahKemasan,
        }
      ];
    }
    
    console.log("kemasanDetailList:", kemasanDetailList);
    
    let produkGudang = item.produkGudang;
    if (!produkGudang) {
      produkGudang = await prisma.produkGudang.findFirst({
        where: {
          gudangId: request.gudangId,
          nama: { equals: item.produkNama, mode: 'insensitive' },
        },
        include: { kemasan: true },
      });
    }
    
    console.log("produkGudang:", produkGudang ? produkGudang.nama : "NOT FOUND");
    console.log("produkGudang kemasan:", produkGudang ? produkGudang.kemasan : []);
    
    const bulkTersedia = Number(produkGudang.stok) || 0;
    
    if (kemasanDetailList.length > 0) {
      let butuhDariBulk = 0;
      for (const pkg of kemasanDetailList) {
        const ukuranKg = Number(pkg.ukuranKg);
        const jumlahReq = Number(pkg.jumlahKemasan);
        const config = produkGudang.kemasan.find((k) => Math.abs(Number(k.ukuranKg) - ukuranKg) < 0.01);
        const stokKemasan = config ? config.stokKemasan : 0;
        const defisitPack = Math.max(0, jumlahReq - stokKemasan);
        butuhDariBulk += defisitPack * ukuranKg;
        
        console.log(`pkg: ${ukuranKg}kg x ${jumlahReq}. stokKemasan: ${stokKemasan}. defisitPack: ${defisitPack}. butuhDariBulk: ${butuhDariBulk}`);
      }
      if (butuhDariBulk > bulkTersedia) {
         console.log(`ERROR: kurang ${Math.round((butuhDariBulk - bulkTersedia) * 10) / 10} kg (perlu dikemas ${butuhDariBulk} kg dari curah, stok curah ${bulkTersedia} kg)`);
      } else {
         console.log(`SUKSES: butuhDariBulk ${butuhDariBulk} <= bulkTersedia ${bulkTersedia}`);
      }
    } else {
      const qtyToDeduct = item.jumlahPermintaan;
      
      let totalKemasanKg = 0;
      if (produkGudang.kemasan) {
         for (const k of produkGudang.kemasan) {
            totalKemasanKg += Number(k.stokKemasan) * Number(k.ukuranKg);
         }
      }
      const totalTersedia = bulkTersedia + totalKemasanKg;
      
      if (qtyToDeduct > totalTersedia) {
         console.log(`ERROR: kurang ${Math.round((qtyToDeduct - totalTersedia) * 10) / 10} kg (butuh ${qtyToDeduct} kg, total stok ${totalTersedia} kg)`);
      } else {
         console.log(`SUKSES: qtyToDeduct ${qtyToDeduct} <= totalTersedia ${totalTersedia}`);
      }
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
