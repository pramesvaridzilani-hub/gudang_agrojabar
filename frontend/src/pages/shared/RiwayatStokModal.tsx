import React, { useEffect, useState } from 'react';
import { X, Clock, Loader2, Plus, Minus, FileText } from 'lucide-react';
import api from '../../lib/api';

interface RiwayatStokModalProps {
  produkGudangId: string;
  produkNama: string;
  onClose: () => void;
}

interface Riwayat {
  id: string;
  jenisStok: 'SEGAR' | 'FROZEN';
  operasi: 'TAMBAH' | 'KURANG' | 'PENYESUAIAN';
  jumlah: number;
  ukuranKemasanKg?: number;
  stokSebelumnya: number;
  stokSetelahnya: number;
  keterangan: string;
  createdAt: string;
  pengguna: {
    nama: string;
    peran: string;
  };
}

const formatStok = (stok: number | string | undefined | null) => {
  if (stok === undefined || stok === null) return 0;
  const num = Number(stok);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
};

const RiwayatStokModal: React.FC<RiwayatStokModalProps> = ({ produkGudangId, produkNama, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRiwayat = async () => {
      try {
        const prefix = location.pathname.startsWith('/admin') ? '/admin' : '/staf';
        // Note: the backend route is actually /api/produk/staf/:id/riwayat or /api/produk/admin/:id/riwayat
        const res = await api.get(`/produk${prefix}/${produkGudangId}/riwayat`);
        setRiwayat(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Gagal memuat riwayat stok.');
      } finally {
        setLoading(false);
      }
    };
    fetchRiwayat();
  }, [produkGudangId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl relative shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-5 py-4 text-white flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Riwayat Perubahan Stok</h3>
            <p className="text-[11px] text-blue-50/80 truncate">{produkNama}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
              <p className="text-sm font-medium text-slate-500">Memuat riwayat stok...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium text-center">
              {error}
            </div>
          ) : riwayat.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-100 rounded-2xl">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Belum ada riwayat</h3>
              <p className="text-xs text-slate-500 mt-1">Stok produk ini belum pernah mengalami perubahan manual.</p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {riwayat.map((r, i) => (
                <div key={r.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Icon Marker */}
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${
                    r.operasi === 'TAMBAH' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {r.operasi === 'TAMBAH' ? <Plus size={16} strokeWidth={3} /> : <Minus size={16} strokeWidth={3} />}
                  </div>

                  {/* Card */}
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 text-[9px] font-bold uppercase rounded-lg ${r.jenisStok === 'SEGAR' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.jenisStok} {r.ukuranKemasanKg ? `(${formatStok(r.ukuranKemasanKg)}kg)` : ''}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(r.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-700 font-semibold mb-3">{r.keterangan}</p>
                    
                    <div className="flex items-center gap-4 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <p className="text-slate-400 font-medium mb-0.5">Sebelum</p>
                        <p className="font-bold text-slate-700">{formatStok(r.stokSebelumnya)} {r.jenisStok === 'FROZEN' ? 'pack' : 'kg'}</p>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="h-px bg-slate-200 w-full relative">
                          <div className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold px-1.5 bg-slate-50 ${r.operasi === 'TAMBAH' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {r.operasi === 'TAMBAH' ? '+' : '-'}{formatStok(r.jumlah)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 font-medium mb-0.5">Setelah</p>
                        <p className="font-bold text-slate-800">{formatStok(r.stokSetelahnya)} {r.jenisStok === 'FROZEN' ? 'pack' : 'kg'}</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Oleh: <span className="font-semibold text-slate-700">{r.pengguna?.nama || 'Sistem'}</span></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiwayatStokModal;
