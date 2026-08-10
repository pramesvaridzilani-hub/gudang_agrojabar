import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/shared/StokManagementPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update Interface
old_interface = """interface ProdukStok {
  id: string;
  nama: string;
  deskripsi: string | null;
  satuan: string;
  hargaGudang: number;
  stok: number;
  stokReserved: number;
  gudangId: string;
  gudang: { id: string; kode: string; nama: string };
  kemasan: KemasanItem[];
  masterKomoditas?: { kodeKomoditasGlobal?: string | null } | null;
  kodeKomoditasGlobal?: string | null;
}"""

new_interface = """interface JadwalAktif {
  id: string;
  komoditasNama: string;
  volumeTotalKg: number;
  tanggalMulai: string;
  tanggalSelesai: string;
  nomorJadwal: string | null;
}

interface ProdukStok {
  id: string;
  nama: string;
  deskripsi: string | null;
  satuan: string;
  hargaGudang: number;
  stok: number;
  stokReserved: number;
  stokBooked?: number;
  jadwalAktif?: JadwalAktif[];
  gudangId: string;
  gudang: { id: string; kode: string; nama: string };
  kemasan: KemasanItem[];
  masterKomoditas?: { kodeKomoditasGlobal?: string | null } | null;
  kodeKomoditasGlobal?: string | null;
}"""

content = content.replace(old_interface, new_interface)

# Add Modal State
old_state = """  const [riwayatProduct, setRiwayatProduct] = useState<{ id: string, nama: string } | null>(null);


  const fetchProducts = async () => {"""

new_state = """  const [riwayatProduct, setRiwayatProduct] = useState<{ id: string, nama: string } | null>(null);

  // Booking Modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingProduct, setBookingProduct] = useState<ProdukStok | null>(null);

  const fetchProducts = async () => {"""

content = content.replace(old_state, new_state)

# Update Curah Box
old_curah = """                  {/* Curah */}
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
                  </div>"""

new_curah = """                  {/* Curah */}
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 text-center relative overflow-hidden">
                    <p className="text-[9px] text-emerald-600 font-semibold uppercase relative z-10">Sayur Segar (Curah)</p>
                    <div className="flex justify-center items-end gap-1 mt-0.5 relative z-10">
                      <p className="text-base font-bold text-emerald-700 leading-none">{(stokBulk - formatStok(prod.stokBooked)).toLocaleString('id-ID')}</p>
                      <p className="text-[9px] text-emerald-600 font-bold mb-0.5">Avail</p>
                    </div>
                    {(prod.stokBooked || 0) > 0 && (
                      <button 
                        onClick={() => { setBookingProduct(prod); setBookingModalOpen(true); }}
                        className="text-[9px] text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 rounded px-1.5 py-0.5 font-medium mt-1 relative z-10 transition-colors inline-block"
                      >
                        {formatStok(prod.stokBooked).toLocaleString('id-ID')} kg di-booking
                      </button>
                    )}
                    <p className="text-[8px] text-emerald-500/70 mt-0.5 relative z-10">Total Fisik: {stokBulk.toLocaleString('id-ID')} kg</p>
                    {(prod.stokBooked || 0) > 0 && (
                      <div className="absolute bottom-0 left-0 h-1 bg-red-400" style={{ width: `${Math.min(100, ((prod.stokBooked || 0) / prod.stok) * 100)}%` }}></div>
                    )}
                  </div>"""

content = content.replace(old_curah, new_curah)

# Add Modal at the end of the file
old_end = """    </div>
  );
};

export default StokManagementPage;"""

new_end = """      {/* Modal - Booking Jadwal Produksi (Buku Besar) */}
      {bookingModalOpen && bookingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl relative shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Buku Besar Reservasi Jadwal</h3>
                <p className="text-[11px] text-red-100">{bookingProduct.nama}</p>
              </div>
              <button onClick={() => setBookingModalOpen(false)} className="text-white/80 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 bg-slate-50">
              <div className="flex gap-4 mb-4 items-center bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex-1 text-center border-r border-slate-100">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Fisik</p>
                  <p className="text-sm font-bold text-slate-800">{formatStok(bookingProduct.stok).toLocaleString('id-ID')} kg</p>
                </div>
                <div className="flex-1 text-center border-r border-slate-100">
                  <p className="text-[10px] text-red-400 font-semibold uppercase">Di-Booking</p>
                  <p className="text-sm font-bold text-red-600">{formatStok(bookingProduct.stokBooked).toLocaleString('id-ID')} kg</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-emerald-500 font-semibold uppercase">Sisa Tersedia</p>
                  <p className="text-sm font-bold text-emerald-600">{(formatStok(bookingProduct.stok) - formatStok(bookingProduct.stokBooked)).toLocaleString('id-ID')} kg</p>
                </div>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {bookingProduct.jadwalAktif?.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">Tidak ada jadwal produksi aktif yang me-reservasi stok ini.</p>
                ) : (
                  bookingProduct.jadwalAktif?.map((j) => (
                    <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center hover:border-red-200 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{j.nomorJadwal || 'No. Jadwal'}</span>
                          <span className="text-xs font-semibold text-slate-800">
                            {new Date(j.tanggalMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            {j.tanggalMulai !== j.tanggalSelesai && ` - ${new Date(j.tanggalSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">Jadwal Aktif (Belum Selesai)</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg">
                          - {j.volumeTotalKg.toLocaleString('id-ID')} kg
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StokManagementPage;"""

content = content.replace(old_end, new_end)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
