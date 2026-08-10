import re

file_path = 'd:/warehouse/warehouse/backend/src/controllers/produk/get-produk-gudang.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """    const jadwalAktif = await prisma.jadwalProduksi.findMany({
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
    });"""

new_logic = """    const jadwalAktif = await prisma.jadwalProduksi.findMany({
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
      }
    });"""

content = content.replace(old_logic, new_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
