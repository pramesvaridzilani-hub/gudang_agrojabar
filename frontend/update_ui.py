import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/shared/StokManagementPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace KemasanItem
content = re.sub(
    r'interface KemasanItem \{\s*id: string;\s*ukuranKg: number;\s*stokKemasan: number;\s*\}',
    'interface KemasanItem {\n  id: string;\n  ukuranKg: number;\n  stokKemasan: number;\n  stokKemasanReserved: number;\n}',
    content
)

# Replace ProdukStok
content = re.sub(
    r'stok: number;\s*gudangId: string;',
    'stok: number;\n  stokReserved: number;\n  gudangId: string;',
    content
)

# String replacement (no regex needed)
old_breakdown = """                {/* Stock breakdown */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {/* Curah */}
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-emerald-600 font-semibold uppercase">Sayur Segar</p>
                    <p className="text-base font-bold text-emerald-700 mt-0.5">{stokBulk.toLocaleString('id-ID')}</p>
                    <p className="text-[9px] text-emerald-500">kg (belum dikemas)</p>
                  </div>

                  {/* Kemasan */}
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-amber-600 font-semibold uppercase">Frozen</p>
                    <p className="text-base font-bold text-amber-700 mt-0.5">{totalKemasanKg.toLocaleString('id-ID')}</p>
                    <p className="text-[9px] text-amber-500">kg total kemasan</p>
                  </div>
                </div>

                {/* Kemasan detail breakdown */}
                <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                  <span className="px-2 py-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold rounded">
                    1kg: {kemasanItems.find(k => k.ukuranKg === 1)?.stokKemasan || 0} pack
                  </span>
                  <span className="px-2 py-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold rounded">
                    2,5kg: {kemasanItems.find(k => k.ukuranKg === 2.5)?.stokKemasan || 0} pack
                  </span>
                  <span className="px-2 py-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold rounded">
                    Custom: {kemasanItems.filter(k => k.ukuranKg !== 1 && k.ukuranKg !== 2.5).reduce((sum, k) => sum + k.stokKemasan, 0)} pack
                  </span>
                </div>"""

new_breakdown = """                {/* Stock breakdown */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {/* Curah */}
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 text-center relative overflow-hidden">
                    <p className="text-[9px] text-emerald-600 font-semibold uppercase relative z-10">Sayur Segar (Curah)</p>
                    <div className="flex justify-center items-end gap-1 mt-0.5 relative z-10">
                      <p className="text-base font-bold text-emerald-700 leading-none">{(stokBulk - formatStok(prod.stokReserved)).toLocaleString('id-ID')}</p>
                      <p className="text-[9px] text-emerald-600 font-bold mb-0.5">Avail</p>
                    </div>
                    {prod.stokReserved > 0 && (
                      <p className="text-[9px] text-red-500 font-medium mt-1 relative z-10">
                        {formatStok(prod.stokReserved).toLocaleString('id-ID')} kg di-booking
                      </p>
                    )}
                    <p className="text-[8px] text-emerald-500/70 mt-0.5 relative z-10">Total Fisik: {stokBulk.toLocaleString('id-ID')} kg</p>
                    {prod.stokReserved > 0 && (
                      <div className="absolute bottom-0 left-0 h-1 bg-red-400" style={{ width: `${Math.min(100, (prod.stokReserved / prod.stok) * 100)}%` }}></div>
                    )}
                  </div>

                  {/* Kemasan */}
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-amber-600 font-semibold uppercase">Frozen (Kemasan)</p>
                    <p className="text-base font-bold text-amber-700 mt-0.5">{totalKemasanKg.toLocaleString('id-ID')}</p>
                    <p className="text-[9px] text-amber-500">kg total fisik</p>
                  </div>
                </div>

                {/* Kemasan detail breakdown */}
                <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                  {[1, 2.5].map((ukuran) => {
                    const item = kemasanItems.find(k => k.ukuranKg === ukuran);
                    const stok = item?.stokKemasan || 0;
                    const reserved = item?.stokKemasanReserved || 0;
                    const avail = stok - reserved;
                    return (
                      <span key={ukuran} className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold rounded flex items-center gap-1">
                        {ukuran}kg: <span className={avail <= 0 && reserved > 0 ? 'text-red-600' : ''}>{avail} pack</span>
                        {reserved > 0 && (
                          <span className="text-[9px] text-red-500 bg-red-50 px-1 rounded-sm border border-red-100">
                            {reserved} booking
                          </span>
                        )}
                      </span>
                    );
                  })}
                  
                  {/* Custom sizes */}
                  {kemasanItems.filter(k => k.ukuranKg !== 1 && k.ukuranKg !== 2.5 && k.stokKemasan > 0).map(item => {
                    const avail = item.stokKemasan - (item.stokKemasanReserved || 0);
                    return (
                      <span key={item.ukuranKg} className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold rounded flex items-center gap-1">
                        {item.ukuranKg}kg: <span className={avail <= 0 && item.stokKemasanReserved > 0 ? 'text-red-600' : ''}>{avail} pack</span>
                        {item.stokKemasanReserved > 0 && (
                          <span className="text-[9px] text-red-500 bg-red-50 px-1 rounded-sm border border-red-100">
                            {item.stokKemasanReserved} booking
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>"""

content = content.replace(old_breakdown, new_breakdown)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
