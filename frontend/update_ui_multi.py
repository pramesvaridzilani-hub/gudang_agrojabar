import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add selectedDemands state
old_state = """  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);"""

new_state = """  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemands, setSelectedDemands] = useState<any[]>([]);"""
content = content.replace(old_state, new_state)

# Add checkbox to thead
old_thead = """                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-3 px-3 text-xs font-bold text-gray-500">Komoditas</th>"""

new_thead = """                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-3 px-3 text-xs font-bold text-gray-500 w-10 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 rounded border-gray-300"
                            checked={demandPoolList.length > 0 && selectedDemands.length === demandPoolList.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDemands([...demandPoolList]);
                              } else {
                                setSelectedDemands([]);
                              }
                            }}
                          />
                        </th>
                        <th className="py-3 px-3 text-xs font-bold text-gray-500">Komoditas</th>"""
content = content.replace(old_thead, new_thead)

# Add checkbox to tbody
old_tbody = """                    <tbody className="divide-y divide-gray-50">
                      {demandPoolList.map((demand, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-4 px-3 font-bold text-gray-900">{demand.produkNama}</td>"""

new_tbody = """                    <tbody className="divide-y divide-gray-50">
                      {demandPoolList.map((demand, idx) => {
                        const isSelected = selectedDemands.some(d => d.produkNama === demand.produkNama && d.ukuranKg === demand.ukuranKg);
                        return (
                        <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                          <td className="py-4 px-3 text-center">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded border-gray-300"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedDemands(prev => prev.filter(d => !(d.produkNama === demand.produkNama && d.ukuranKg === demand.ukuranKg)));
                                } else {
                                  setSelectedDemands(prev => [...prev, demand]);
                                }
                              }}
                            />
                          </td>
                          <td className="py-4 px-3 font-bold text-gray-900">{demand.produkNama}</td>"""
content = content.replace(old_tbody, new_tbody)

# Add closing bracket for map
old_tr_close = """                        </tr>
                      ))}
                    </tbody>"""

new_tr_close = """                        </tr>
                      )})}
                    </tbody>"""
content = content.replace(old_tr_close, new_tr_close)

# Add Action Bar at the bottom of the Demand Pool table
old_table_close = """                  </table>
                </div>
              </div>
            </div>
          )}"""

new_table_close = """                  </table>
                </div>
              </div>
              
              {/* Floating Action Bar for Selection */}
              {selectedDemands.length > 0 && (
                <div className="mt-4 bg-blue-600 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Package size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold">{selectedDemands.length} Kebutuhan Dipilih</p>
                      <p className="text-xs text-blue-100">
                        Total Kebutuhan Curah (Net): {selectedDemands.reduce((sum, d) => sum + d.totalKgKurang, 0)} kg
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                      const selectedItems = selectedDemands.map(d => {
                         const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                         const requiredGross = Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                         return {
                            nama: d.produkNama,
                            volumeKg: String(requiredGross),
                            kemasan: String(d.ukuranKg)
                         };
                      });
                      navigate('baru', { state: { selectedItems } });
                    }}
                    className="bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors"
                  >
                    Buat Jadwal Gabungan
                  </button>
                </div>
              )}
            </div>
          )}"""
content = content.replace(old_table_close, new_table_close)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
