import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the "Select All" checkbox onChange
old_select_all = """                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDemands([...demandPoolList]);
                              } else {
                                setSelectedDemands([]);
                              }
                            }}"""

new_select_all = """                            onChange={(e) => {
                              if (e.target.checked) {
                                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                                let totalGross = 0;
                                demandPoolList.forEach(d => {
                                  const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                                  totalGross += Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                                });
                                if (totalGross > 1000) {
                                  alert(`Kapasitas produksi harian maksimal 1000 kg bahan mentah. Total semua kebutuhan adalah ${totalGross} kg. Silakan pilih satu per satu secara manual.`);
                                  return;
                                }
                                setSelectedDemands([...demandPoolList]);
                              } else {
                                setSelectedDemands([]);
                              }
                            }}"""
content = content.replace(old_select_all, new_select_all)


# Replace the individual checkbox onChange
old_select_one = """                              onChange={() => {
                                if (isSelected) {
                                  setSelectedDemands(prev => prev.filter(d => !(d.produkNama === demand.produkNama && d.ukuranKg === demand.ukuranKg)));
                                } else {
                                  setSelectedDemands(prev => [...prev, demand]);
                                }
                              }}"""

new_select_one = """                              onChange={() => {
                                if (isSelected) {
                                  setSelectedDemands(prev => prev.filter(d => !(d.produkNama === demand.produkNama && d.ukuranKg === demand.ukuranKg)));
                                } else {
                                  const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                                  let currentGross = 0;
                                  selectedDemands.forEach(d => {
                                    const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                                    currentGross += Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                                  });
                                  const thisLoss = YIELD_LOSS_MAP[demand.produkNama] || 0;
                                  const thisGross = Math.ceil(demand.totalKgKurang / (1 - (thisLoss / 100)));
                                  
                                  if (currentGross + thisGross > 1000) {
                                    alert(`Kapasitas produksi harian maksimal 1000 kg bahan mentah.\\n\\nKombinasi yang Anda pilih akan mencapai ${currentGross + thisGross} kg mentah.\\nSilakan buat jadwal terpisah untuk sisanya.`);
                                    return;
                                  }
                                  setSelectedDemands(prev => [...prev, demand]);
                                }
                              }}"""
content = content.replace(old_select_one, new_select_one)

# Also update the text in the action bar to show the total Gross
old_action_bar = """                        Total Kebutuhan Curah (Net): {selectedDemands.reduce((sum, d) => sum + d.totalKgKurang, 0)} kg
                      </p>"""

new_action_bar = """                        Total Kebutuhan (Net): {selectedDemands.reduce((sum, d) => sum + d.totalKgKurang, 0)} kg | 
                        Estimasi Mentah (Gross): {selectedDemands.reduce((sum, d) => {
                          const loss = { Wortel: 35, Jagung: 70, Buncis: 7 }[d.produkNama as 'Wortel'|'Jagung'|'Buncis'] || 0;
                          return sum + Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                        }, 0)} kg
                      </p>"""
content = content.replace(old_action_bar, new_action_bar)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
