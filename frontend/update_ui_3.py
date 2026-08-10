import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_row = """                            <button
                              onClick={() => navigate(`baru?komoditas=${encodeURIComponent(demand.produkNama)}&volume=${demand.totalKgKurang}`)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                            >"""

new_row = """                            <button
                              onClick={() => {
                                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                                const loss = YIELD_LOSS_MAP[demand.produkNama] || 0;
                                const requiredGross = Math.ceil(demand.totalKgKurang / (1 - (loss / 100)));
                                navigate(`baru?komoditas=${encodeURIComponent(demand.produkNama)}&volume=${requiredGross}`);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                            >"""

content = content.replace(old_row, new_row)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
