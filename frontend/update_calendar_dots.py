import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """  const dateCellRender = (value: Dayjs) => {
    // Cari apakah ada jadwal aktif di tanggal ini
    const listData = jadwalList.filter(j => {
      if (j.statusJadwal !== 'AKTIF') return false;
      const jDate = dayjs(j.tenggatWaktu);
      return jDate.isSame(value, 'day');
    });"""

new_logic = """  const dateCellRender = (value: Dayjs) => {
    // Cari apakah ada jadwal aktif di tanggal ini
    const listData = jadwalList.filter(j => {
      if (j.statusJadwal !== 'AKTIF') return false;
      const valDate = value.toDate();
      const start = new Date(j.tanggalMulai);
      start.setHours(0, 0, 0, 0);
      const end = new Date(j.tanggalSelesai);
      end.setHours(23, 59, 59, 999);
      return valDate >= start && valDate <= end;
    });"""

content = content.replace(old_logic, new_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
