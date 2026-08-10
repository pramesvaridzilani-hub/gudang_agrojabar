import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                const selectedItems = selectedDemands.map(d => {
                    const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                    const requiredGross = Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                    return {
                      nama: d.produkNama,
                      volumeKg: String(requiredGross),
                      kemasan: String(d.ukuranKg)
                    };
                });"""

new_logic = """                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                
                const groups: Record<string, { totalGross: number, packBesar: number }> = {};
                selectedDemands.forEach(d => {
                  const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                  const gross = Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                  if (!groups[d.produkNama]) groups[d.produkNama] = { totalGross: 0, packBesar: 0 };
                  groups[d.produkNama].totalGross += gross;
                  
                  if (String(d.ukuranKg) === '2.5') {
                    groups[d.produkNama].packBesar += d.totalPackKurang;
                  }
                });

                const selectedItems = Object.keys(groups).map(nama => {
                  const data = groups[nama];
                  const demandsForProd = selectedDemands.filter(d => d.produkNama === nama);
                  const isKombinasi = demandsForProd.length > 1;
                  
                  if (isKombinasi) {
                    return {
                      nama,
                      volumeKg: String(data.totalGross),
                      kemasan: 'kombinasi',
                      kemasanKombinasiBesar: String(data.packBesar)
                    };
                  } else {
                    return {
                      nama,
                      volumeKg: String(data.totalGross),
                      kemasan: String(demandsForProd[0].ukuranKg),
                      kemasanKombinasiBesar: '0'
                    };
                  }
                });"""

content = content.replace(old_logic, new_logic)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
