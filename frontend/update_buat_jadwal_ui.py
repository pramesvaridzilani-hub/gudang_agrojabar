import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update validation UI
ui_old = """                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={item.volumeKg}
                          onChange={(e) => updateItem('volumeKg', e.target.value)}
                          placeholder="cth: 2500"
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 ${isVolumeExcessive ? 'border-red-400 focus:border-red-500 focus:ring-red-200 text-red-600' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-200'}`}
                        />
                        {isVolumeExcessive && (
                          <p className="text-[10px] text-red-500 mt-1 font-medium">
                            Bahan baku kurang, tidak bisa melebihi {stockAvailable.toLocaleString('id-ID')} kg
                          </p>
                        )}"""

ui_new = """                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={item.volumeKg}
                          onChange={(e) => updateItem('volumeKg', e.target.value)}
                          placeholder="cth: 2500"
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 ${isVolumeExcessive ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-200 text-amber-700' : 'border-gray-200 focus:border-emerald-400 focus:ring-emerald-200'}`}
                        />
                        {isVolumeExcessive && !orderedDeficits[item.id] && (
                          <div className="mt-2 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                            <p className="text-[10px] text-amber-700 font-medium mb-1.5 flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Stok kurang {Math.max(0, rawVolume - stockAvailable).toLocaleString('id-ID')} kg mentah
                            </p>
                            <button
                              type="button"
                              onClick={() => handlePesanKekurangan(item, Math.max(0, rawVolume - stockAvailable))}
                              disabled={orderLoading[item.id]}
                              className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded shadow-sm flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                            >
                              {orderLoading[item.id] ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              Pesan {Math.max(0, rawVolume - stockAvailable).toLocaleString('id-ID')} kg ke Petani
                            </button>
                          </div>
                        )}
                        {orderedDeficits[item.id] && (
                          <div className="mt-2 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <p className="text-[10px] text-emerald-700 font-medium">
                              Kekurangan {Math.max(0, rawVolume - stockAvailable).toLocaleString('id-ID')} kg telah dipesan!
                            </p>
                          </div>
                        )}"""

content = content.replace(ui_old, ui_new)

# Update "Simpan Jadwal" button disabled state
btn_old = """                <button
                  type="button"
                  onClick={handleSimpan}
                  disabled={!isFormReady || saveLoading || !preview}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm shadow-sm shadow-emerald-200 hover:bg-emerald-700 hover:shadow disabled:opacity-50 disabled:hover:shadow-sm disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
                >
                  {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan Jadwal
                </button>"""

btn_new = """                <button
                  type="button"
                  onClick={handleSimpan}
                  disabled={!isSaveReady || saveLoading || !preview}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm shadow-sm shadow-emerald-200 hover:bg-emerald-700 hover:shadow disabled:opacity-50 disabled:hover:shadow-sm disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
                >
                  {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan Jadwal
                </button>"""
content = content.replace(btn_old, btn_new)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
