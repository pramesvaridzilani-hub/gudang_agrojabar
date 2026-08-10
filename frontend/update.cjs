const fs = require('fs');
let content = fs.readFileSync('BuatJadwalPage.backup.tsx', 'utf8');

// 1. Replace form state for komoditas and volume with items array
content = content.replace(/const \[form, setForm\] = useState\(\{[^]*?\}\);/m, 
`const [form, setForm] = useState({
    tenggat: '',
    kapasitasHarianKg: '1000',
    catatanJadwal: '',
    pengajuanId: '',
  });

  type KomoditasItem = {
    id: string;
    nama: string;
    volumeKg: string;
    kemasan: string;
    kemasanKustom: string;
    kemasanKombinasiBesar: string;
  };

  const [items, setItems] = useState<KomoditasItem[]>([{
    id: Date.now().toString(),
    nama: '',
    volumeKg: '',
    kemasan: '1',
    kemasanKustom: '5',
    kemasanKombinasiBesar: '0'
  }]);`);

// 2. Remove old Kemasan state and yield calculation which is now per item
content = content.replace(/const \[kemasan, setKemasan\] = useState.*?const sisaTidakTerkemasKg = sisaKombinasiKg % 1;/ms, 
`const totalVolumeKg = items.reduce((sum, it) => sum + (parseFloat(it.volumeKg) || 0), 0);
  const namaKomoditasGabungan = items.map(it => it.nama).filter(Boolean).join(', ');`);

// 3. Update isFormReady
content = content.replace(/const isFormReady =.*?form\.tenggat !== '';/ms, 
`const isFormReady =
    items.every(it => it.nama.trim() !== '' && parseFloat(it.volumeKg) > 0) &&
    items.length > 0 &&
    form.tenggat !== '';`);

// 4. Update hitungPreview
content = content.replace(/volumeTotalKg: parseFloat\(form\.volumeTotalKg\)/g, 'volumeTotalKg: totalVolumeKg');
content = content.replace(/\[form\.volumeTotalKg, form\.tenggat/g, '[totalVolumeKg, form.tenggat');

// 5. Update handleSimpan
content = content.replace(/komoditasNama: form\.komoditasNama\.trim\(\)/g, 'komoditasNama: namaKomoditasGabungan');
content = content.replace(/catatanJadwal: form\.catatanJadwal\.trim\(\) \|\| undefined,/g, 'catatanJadwal: form.catatanJadwal.trim() || undefined,\n        detailKomoditas: items,');

// 6. Update handleReset
content = content.replace(/komoditasNama: '',\s*volumeTotalKg: '',/g, '');
content = content.replace(/setPreview\(null\);/g, `setItems([{
      id: Date.now().toString(),
      nama: '',
      volumeKg: '',
      kemasan: '1',
      kemasanKustom: '5',
      kemasanKombinasiBesar: '0'
    }]);
    setPreview(null);`);

// 7. Update the UI for Komoditas and Volume to use map
const uiRegex = /\{\/\*\s*Komoditas\s*\*\/\}.*?(?=\{\/\*\s*Tenggat\s*\*\/\})/ms;

const newUI = `{/* List Komoditas */}
            <div className="space-y-4 mb-4">
              {items.map((item, index) => {
                const yieldLoss = YIELD_LOSS_MAP[item.nama] || 0;
                const rawVolume = parseFloat(item.volumeKg) || 0;
                const penyusutanKg = rawVolume * (yieldLoss / 100);
                const hasilJadiKg = Math.max(0, rawVolume - penyusutanKg);
                const ukuranKemasan = item.kemasan === 'kustom' ? (parseFloat(item.kemasanKustom) || 1) : parseFloat(item.kemasan);
                const estimasiKemasan = hasilJadiKg > 0 && ukuranKemasan > 0 ? Math.floor(hasilJadiKg / ukuranKemasan) : 0;
                
                const jumlahBesar = parseInt(item.kemasanKombinasiBesar) || 0;
                const maxBesar = Math.floor(hasilJadiKg / 2.5);
                const sisaKombinasiKg = Math.max(0, hasilJadiKg - (Math.min(jumlahBesar, maxBesar) * 2.5));
                const kemasanKombinasiKecil = Math.floor(sisaKombinasiKg / 1);
                const sisaTidakTerkemasKg = sisaKombinasiKg % 1;

                const updateItem = (key: keyof KomoditasItem, val: string) => {
                  const newItems = [...items];
                  newItems[index] = { ...newItems[index], [key]: val };
                  setItems(newItems);
                  setSaved(false);
                };

                return (
                  <div key={item.id} className="border border-gray-100 bg-gray-50/50 rounded-xl p-4 relative">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter(it => it.id !== item.id))}
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs font-semibold"
                        title="Hapus Komoditas"
                      >
                        Hapus
                      </button>
                    )}
                    <h3 className="font-semibold text-gray-700 text-sm mb-3">Komoditas #{index + 1}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Nama <span className="text-red-500">*</span></label>
                        <select
                          value={item.nama}
                          onChange={(e) => updateItem('nama', e.target.value)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                        >
                          <option value="">-- Pilih Komoditas --</option>
                          <option value="Wortel">🥕 Wortel</option>
                          <option value="Jagung">🌽 Jagung</option>
                          <option value="Buncis">🫘 Buncis</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Volume (kg) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={item.volumeKg}
                          onChange={(e) => updateItem('volumeKg', e.target.value)}
                          placeholder="cth: 2500"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                        />
                      </div>
                    </div>
                    
                    {item.nama && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                         <div>
                            <p className="text-xs font-bold text-amber-800 mb-1">🌾 Estimasi Hasil Jadi (Penyusutan {yieldLoss}%)</p>
                            <div className="flex justify-between items-center bg-white border border-amber-100 rounded-lg px-3 py-2">
                              <span className="text-xs text-amber-600">Volume Bersih:</span>
                              <span className="font-bold text-amber-700">{hasilJadiKg.toLocaleString('id-ID')} kg</span>
                            </div>
                         </div>
                         <div className="pt-2 border-t border-amber-100/50">
                            <p className="text-xs font-bold text-amber-800 mb-2">📦 Target Kemasan</p>
                            <div className="flex gap-2 mb-2">
                              {['1', '2.5', 'kustom', 'kombinasi'].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => updateItem('kemasan', opt)}
                                  className={\`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all \${
                                    item.kemasan === opt
                                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                      : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                                  }\`}
                                >
                                  {opt === 'kustom' ? 'Kustom' : opt === 'kombinasi' ? 'Kombinasi' : \`\${opt} kg\`}
                                </button>
                              ))}
                            </div>

                            {item.kemasan === 'kombinasi' && (
                              <div className="space-y-2 mt-3 p-3 bg-white border border-amber-100 rounded-lg">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-amber-700 w-1/2">Kemasan 2.5 kg:</span>
                                  <div className="flex items-center gap-2 w-1/2">
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxBesar}
                                      value={item.kemasanKombinasiBesar}
                                      onChange={(e) => {
                                        const valStr = e.target.value;
                                        if (valStr === '') {
                                          updateItem('kemasanKombinasiBesar', '');
                                          return;
                                        }
                                        const val = parseInt(valStr);
                                        if (!isNaN(val)) {
                                          if (val > maxBesar) {
                                            updateItem('kemasanKombinasiBesar', maxBesar.toString());
                                          } else {
                                            updateItem('kemasanKombinasiBesar', val.toString());
                                          }
                                        }
                                      }}
                                      className="w-full rounded-md border border-amber-200 px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                                    />
                                    <span className="text-[10px] text-gray-500">pack</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 border-t border-amber-50 pt-2">
                                  <span className="text-xs font-semibold text-amber-700 w-1/2">Kemasan 1 kg:</span>
                                  <div className="w-1/2 text-right">
                                    <span className="text-sm font-black text-amber-600">{kemasanKombinasiKecil} pack</span>
                                  </div>
                                </div>
                                {sisaTidakTerkemasKg > 0 && (
                                  <p className="text-[10px] text-red-500 italic mt-1 text-right">
                                    *Sisa volume tidak terkemas: {sisaTidakTerkemasKg.toFixed(2)} kg
                                  </p>
                                )}
                              </div>
                            )}

                            {item.kemasan === 'kustom' && (
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="number"
                                  value={item.kemasanKustom}
                                  onChange={(e) => updateItem('kemasanKustom', e.target.value)}
                                  className="flex-1 rounded-lg border border-amber-200 px-3 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                                  placeholder="Berat per kemasan (kg)"
                                />
                                <span className="text-xs font-semibold text-amber-700">kg/pack</span>
                              </div>
                            )}
                            
                            {item.kemasan !== 'kombinasi' && (
                              <div className="bg-emerald-600 rounded-lg px-3 py-2 text-center mt-2 shadow-sm shadow-emerald-200">
                                 <p className="text-[10px] text-emerald-100 mb-0.5">Estimasi Jumlah Kemasan</p>
                                 <p className="text-sm font-black text-white">{estimasiKemasan.toLocaleString('id-ID')} pack</p>
                              </div>
                            )}
                         </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <button
                type="button"
                onClick={() => setItems([...items, { id: Date.now().toString(), nama: '', volumeKg: '', kemasan: '1', kemasanKustom: '5', kemasanKombinasiBesar: '0' }])}
                className="w-full py-2.5 rounded-xl border border-dashed border-emerald-300 text-emerald-600 font-semibold text-sm hover:bg-emerald-50 transition-colors"
              >
                + Tambah Komoditas Lainnya
              </button>
            </div>
`;

content = content.replace(uiRegex, newUI);

// Update tfoot
content = content.replace(/parseFloat\(form\.volumeTotalKg\)/g, 'totalVolumeKg');

fs.writeFileSync('src/pages/pemrosesan/BuatJadwalPage.tsx', content);
