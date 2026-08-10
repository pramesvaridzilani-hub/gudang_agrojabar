import re

file_path = 'd:/warehouse/warehouse/backend/src/controllers/produk/get-produk-gudang.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """    const products = await prisma.produkGudang.findMany({
      where: whereClause,
      include: {
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
          },
        },
        masterKomoditas: {
          select: {
            id: true,
            nama: true,
            kategori: true,
            satuan: true,
            kodeKomoditasGlobal: true,
          },
        },
        kemasan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      statusCode: 200,
      message: 'OK',
      data: products,
    });"""

new_logic = """    const products = await prisma.produkGudang.findMany({
      where: whereClause,
      include: {
        gudang: {
          select: {
            id: true,
            kode: true,
            nama: true,
          },
        },
        masterKomoditas: {
          select: {
            id: true,
            nama: true,
            kategori: true,
            satuan: true,
            kodeKomoditasGlobal: true,
          },
        },
        kemasan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // --- FITUR TRACEABILITY: Ambil jadwal produksi AKTIF ---
    const gudangIds = Array.from(new Set(products.map(p => p.gudangId)));
    const jadwalAktif = await prisma.jadwalProduksi.findMany({
      where: {
        gudangId: { in: gudangIds },
        statusJadwal: 'AKTIF'
      },
      select: {
        id: true,
        komoditasNama: true,
        volumeTotalKg: true,
        tanggalMulai: true,
        tanggalSelesai: true,
        nomorJadwal: true
      }
    });

    const productsWithBooking = products.map(p => {
      const pJadwal = jadwalAktif.filter(j => j.komoditasNama === p.nama);
      const totalBooked = pJadwal.reduce((acc, curr) => acc + curr.volumeTotalKg, 0);
      return {
        ...p,
        jadwalAktif: pJadwal,
        stokBooked: totalBooked
      };
    });
    // ---------------------------------------------------------

    return res.status(200).json({
      statusCode: 200,
      message: 'OK',
      data: productsWithBooking,
    });"""

content = content.replace(old_logic, new_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
