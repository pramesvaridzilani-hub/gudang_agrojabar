import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make calendar mandatory
old_btn = """              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
            >
              <span>Ya, Lanjut Buat Jadwal</span>"""

new_btn = """              disabled={!selectedDate}
              className={`px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2 ${!selectedDate ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              <span>Ya, Lanjut Buat Jadwal</span>"""
content = content.replace(old_btn, new_btn)

# Also update the text to indicate mandatory
old_text = """Pilih Tanggal Jadwal Produksi (Opsional)"""
new_text = """Pilih Tanggal Jadwal Produksi (Wajib)"""
content = content.replace(old_text, new_text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
