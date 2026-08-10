import re

file_path = 'd:/warehouse/warehouse/backend/src/controllers/jadwal-produksi.controller.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """  // Hitung tanggal mulai: mundur dari tenggat
  const tanggalMulai = new Date(tenggat);
  tanggalMulai.setDate(tanggalMulai.getDate() - estimasiHari);"""

new_logic = """  // Hitung tanggal mulai: mundur dari tenggat
  const tanggalMulai = new Date(tenggat);
  tanggalMulai.setDate(tanggalMulai.getDate() - estimasiHari + 1);"""

content = content.replace(old_logic, new_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
