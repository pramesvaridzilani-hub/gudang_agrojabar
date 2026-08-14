import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';
import { getRolePrefix } from '../../lib/rolePathHelper';
import {
  ClipboardList,
  Search,
  Calendar,
  Warehouse,
  Store,
  Loader2,
  ChevronRight,
  Sprout
} from 'lucide-react';

const PengajuanListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = getRolePrefix(location.pathname);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'DIAJUKAN' | 'PROSES' | 'SELESAI'>('ALL');
  const [sortOption, setSortOption] = useState<'NEWEST' | 'OLDEST' | 'REQ_NEAREST'>('NEWEST');
  const [allocatingId, setAllocatingId] = useState<string | null>(null);

  const tabs = [
    { key: 'ALL', label: 'Semua Pengajuan' },
    { key: 'DIAJUKAN', label: 'Baru (Diajukan)' },
    { key: 'PROSES', label: 'Diproses / Dikirim' },
    { key: 'SELESAI', label: 'Tiba / Selesai' },
  ];

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pengajuan');
      setRequests(response.data.data);
    } catch (error) {
      console.error('Error fetching stock requests list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async (id: string) => {
    try {
      setAllocatingId(id);
      await api.post(`/pengajuan/${id}/allocate`);
      await fetchRequests();
    } catch (error) {
      console.error('Error allocating stock:', error);
      alert('Gagal mengalokasikan stok. Silakan coba lagi.');
    } finally {
      setAllocatingId(null);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filter requests based on search and tab selections
  useEffect(() => {
    let result = [...requests];

    // Status filter
    if (activeTab === 'DIAJUKAN') {
      result = result.filter((r) => r.status === 'DIAJUKAN');
    } else if (activeTab === 'PROSES') {
      result = result.filter((r) => ['DIPROSES', 'DIKIRIM'].includes(r.status));
    } else if (activeTab === 'SELESAI') {
      result = result.filter((r) => r.status === 'SELESAI' || r.status === 'TIBA');
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.toko.nama.toLowerCase().includes(q) ||
          r.gudang.nama.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }

    // Sort filter
    if (sortOption === 'NEWEST') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortOption === 'OLDEST') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortOption === 'REQ_NEAREST') {
      result.sort((a, b) => {
        const getDate = (r: any) => r.tanggalPermintaanKirim ? new Date(r.tanggalPermintaanKirim).getTime() : (r.estimasiSampai ? new Date(r.estimasiSampai).getTime() : new Date(r.createdAt).getTime() + 2 * 24 * 60 * 60 * 1000);
        return getDate(a) - getDate(b);
      });
    }

    setFilteredRequests(result);
  }, [requests, search, activeTab, sortOption]);

  const uniqueCommodities = useMemo(() => {
    const names = new Set<string>();
    filteredRequests.forEach(req => {
      req.items?.forEach((item: any) => {
        if (item.produkNama) names.add(item.produkNama);
        else if (item.produkGudang?.nama) names.add(item.produkGudang.nama);
      });
    });
    return Array.from(names).sort();
  }, [filteredRequests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            Manajemen Pengajuan Stok
          </h2>
          <p className="text-xs text-slate-600 mt-1 font-light">
            Kelola, setujui jumlah, perbarui status logistik, dan verifikasi pengadaan barang ke mitra seller.
          </p>
        </div>

        {/* Sort & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="NEWEST">Terbaru - Terlama</option>
            <option value="OLDEST">Terlama - Terbaru</option>
            <option value="REQ_NEAREST">Jadwal Kirim Terdekat</option>
          </select>
          
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Cari ID pengajuan atau toko..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all duration-300 ${
              activeTab === tab.key
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests Listing Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-2xl">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Tidak ada pengajuan yang sesuai dengan kriteria filter Anda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">ID Pengajuan</th>
                <th className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Dari (Toko)</th>
                <th className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Status</th>
                <th className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Tanggal</th>
                {uniqueCommodities.map(comm => (
                  <th key={comm} className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap text-center border-l border-slate-100">{comm}</th>
                ))}
                <th className="py-4 px-4 text-xs font-bold text-slate-500 whitespace-nowrap sticky right-0 bg-slate-50 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] border-l border-slate-200">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => {
                const formattedDate = new Date(req.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-4 px-4 text-xs font-mono font-bold text-emerald-600 group-hover:underline">
                      #{req.id.substring(0, 8)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold whitespace-nowrap">
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        {req.toko.nama}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          req.status === 'DIAJUKAN'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : ['DIPROSES', 'DIKIRIM'].includes(req.status)
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : req.status === 'TIBA'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : req.status === 'SELESAI'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <div>{formattedDate}</div>
                      {req.tanggalPermintaanKirim ? (
                        <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                          Req Kirim: {new Date(req.tanggalPermintaanKirim).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-blue-600 font-semibold mt-1">
                          Estimasi: {new Date(req.estimasiSampai || new Date(new Date(req.createdAt).getTime() + 2 * 24 * 60 * 60 * 1000)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </td>

                    {/* Matrix Cells */}
                    {uniqueCommodities.map(comm => {
                      const item = req.items?.find((i: any) => i.produkNama === comm || i.produkGudang?.nama === comm);
                      if (!item) {
                        return <td key={comm} className="py-4 px-4 text-slate-300 text-center border-l border-slate-100/50">-</td>;
                      }

                      const qty = item.jumlahPermintaan || 0;
                      const stock = item.produkGudang?.stok || 0;
                      const isEnough = stock >= qty;

                      return (
                        <td key={comm} className="py-3 px-3 border-l border-slate-100/50 align-middle">
                          <div className={`mx-auto flex flex-col gap-0.5 items-center justify-center min-w-[70px] px-2 py-1.5 rounded-lg border ${
                            isEnough 
                              ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700' 
                              : 'bg-rose-50/50 border-rose-100 text-rose-700'
                          }`}>
                            <span className="text-xs font-bold leading-none">{qty}</span>
                            <span className="text-[9px] font-semibold opacity-75 leading-none">Stok: {stock}</span>
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-4 px-4 sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-4px_0_12px_rgba(0,0,0,0.03)] border-l border-slate-200 align-middle">
                      <div className="flex flex-col gap-1.5">
                        {['DIAJUKAN', 'MENUNGGU_SEBAGIAN'].includes(req.status) && (
                          <button
                            onClick={() => handleAllocate(req.id)}
                            disabled={allocatingId === req.id}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-400 text-[10px] font-bold flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap w-full shadow-sm"
                          >
                            {allocatingId === req.id ? 'Memproses...' : 'Alokasikan Stok'}
                          </button>
                        )}
                        {req.status === 'MENUNGGU_SEBAGIAN' && (
                          <button
                            onClick={() => navigate(`${prefix}/ajukan-kebutuhan?tab=sinyal`)}
                            className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap w-full shadow-sm"
                            title="Stok tidak mencukupi, teruskan ke petani"
                          >
                            <Sprout size={12} />
                            Minta Petani
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`${prefix}/pengajuan/${req.id}`)}
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 text-xs font-bold flex items-center justify-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap w-full"
                        >
                          Detail <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PengajuanListPage;
