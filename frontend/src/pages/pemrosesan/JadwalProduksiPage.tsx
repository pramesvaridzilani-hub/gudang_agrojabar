import React, { useEffect, useState } from 'react';
import { message, Modal, Calendar, Badge }
from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { jadwalProduksiApi, JadwalProduksi } from '../../api/jadwal-produksi.api';
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  TrendingUp,
  Wallet,
  ChevronRight,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Loader2,
  CheckCircle,
  X,
} from 'lucide-react';

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'text-gray-600 bg-gray-100', icon: <Clock size={13} /> },
  AKTIF: { label: 'Aktif', color: 'text-emerald-700 bg-emerald-100', icon: <TrendingUp size={13} /> },
  SELESAI: { label: 'Selesai', color: 'text-blue-700 bg-blue-100', icon: <CheckCircle2 size={13} /> },
  BATAL: { label: 'Batal', color: 'text-red-700 bg-red-100', icon: <XCircle size={13} /> },
};

const FILTER_TABS = [
  { key: '', label: 'Semua' },
  { key: 'AKTIF', label: 'Aktif' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SELESAI', label: 'Selesai' },
  { key: 'BATAL', label: 'Batal' },
];

const JadwalProduksiPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const gudangId = user?.managedWarehouses?.[0]?.id;
  
  const getYldLoss = (name: string) => {
    const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
    return YIELD_LOSS_MAP[name] || 0;
  };

  const getNetVolume = (j: JadwalProduksi) => {
    return Math.round(j.volumeTotalKg * (1 - (getYldLoss(j.komoditasNama) / 100)));
  };

  // State dari navigasi QC
  const fromQC = location.state?.fromQC as boolean | undefined;
  const highlightKomoditas = location.state?.highlightKomoditas as string | undefined;
  const [showQcBanner, setShowQcBanner] = useState(!!fromQC);

  const [jadwalList, setJadwalList] = useState<JadwalProduksi[]>([]);
  const [antreanList, setAntreanList] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemands, setSelectedDemands] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [demandPoolList, setDemandPoolList] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, antrean, demandPool] = await Promise.all([
        jadwalProduksiApi.getList({
          gudangId: gudangId || undefined,
          statusJadwal: filterStatus || undefined,
        }),
        filterStatus === '' && gudangId ? jadwalProduksiApi.getAntrean(gudangId) : Promise.resolve([]),
        filterStatus === '' ? jadwalProduksiApi.getDemandPool() : Promise.resolve([])
      ]);
      setJadwalList(data);
      if (filterStatus === '') {
        setAntreanList(antrean);
        setDemandPoolList(demandPool);
      }
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data jadwal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterStatus, gudangId]);

  const generateResumeData = () => {
    const groups: Record<string, { net: number, gross: number, packs: string[] }> = {};
    const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
    
    selectedDemands.forEach(d => {
      const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
      const net = d.totalKgKurang;
      const gross = Math.round(net / (1 - (loss / 100)));
      
      if (!groups[d.produkNama]) {
        groups[d.produkNama] = { net: 0, gross: 0, packs: [] };
      }
      
      groups[d.produkNama].net += net;
      groups[d.produkNama].gross += gross;
      groups[d.produkNama].packs.push(`${d.ukuranKg} kg : ${d.totalPackKurang} pack`);
    });
    
    return groups;
  };

  const dateCellRender = (value: Dayjs) => {
    // Cari apakah ada jadwal aktif di tanggal ini
    const listData = jadwalList.filter(j => {
      if (j.statusJadwal !== 'AKTIF') return false;
      const valDate = value.toDate();
      const start = new Date(j.tanggalMulai);
      start.setHours(0, 0, 0, 0);
      const end = new Date(j.tanggalSelesai);
      end.setHours(23, 59, 59, 999);
      return valDate >= start && valDate <= end;
    });

    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        {listData.map(item => {
          const netVal = getNetVolume(item);
          return (
            <div 
              key={item.id} 
              className={`w-1.5 h-1.5 rounded-full mb-0.5 ${netVal > 1000 ? 'bg-red-500' : 'bg-emerald-500'}`} 
              title={`Jadwal Aktif: #${item.id.substring(0, 8)} (${netVal} kg Net)`} 
            />
          );
        })}
      </div>
    );
  };

  // Summary stats
  const stats = {
    total: jadwalList.length,
    aktif: jadwalList.filter((j) => j.statusJadwal === 'AKTIF').length,
    volumeTotal: jadwalList.reduce((s, j) => s + j.volumeTotalKg, 0),
    biayaBorongan: jadwalList.reduce((s, j) => s + (j.summary?.totalBiayaBorongan || 0), 0),
  };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={24} className="text-emerald-600" />
            Jadwal Produksi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Penjadwalan otomatis berdasarkan pesanan grosir · Kapasitas 1 ton/hari
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-all"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => navigate('baru')}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
          >
            <Plus size={15} />
            Buat Jadwal
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: 'Total Jadwal', value: stats.total, icon: <BarChart3 size={18} className="text-gray-500" />, bg: 'bg-white' },
          { label: 'Sedang Aktif', value: stats.aktif, icon: <TrendingUp size={18} className="text-emerald-500" />, bg: 'bg-emerald-50' },
          {
            label: 'Volume Total',
            value: `${(stats.volumeTotal / 1000).toFixed(1)} ton`,
            icon: <Package size={18} className="text-blue-500" />,
            bg: 'bg-blue-50',
          },
          {
            label: 'Biaya Borongan',
            value: formatRupiah(stats.biayaBorongan),
            icon: <Wallet size={18} className="text-amber-500" />,
            bg: 'bg-amber-50',
            small: true,
          },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-white/70 shadow-sm p-4`}>
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-gray-500 font-medium">{s.label}</span>
            </div>
            <p className={`font-bold text-gray-900 ${s.small ? 'text-base' : 'text-xl'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              filterStatus === tab.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={24} className="animate-spin mr-2" /> Memuat data jadwal...
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center text-red-700">
          <AlertTriangle size={24} className="mx-auto mb-2" />
          <p>{error}</p>
          <button onClick={fetchData} className="mt-3 text-sm underline">Coba lagi</button>
        </div>
      ) : (
        <>
          {/* Kolam Kebutuhan Produksi (Demand Pool) */}
          {filterStatus === '' && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Package size={18} className="text-blue-500" />
                Kolam Kebutuhan Produksi (Demand Pool)
                {demandPoolList.length > 0 && (
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{demandPoolList.length} item</span>
                )}
              </h2>

              {/* Banner info dari QC */}
              {showQcBanner && highlightKomoditas && (
                <div className="mb-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm">
                    <p className="font-bold text-emerald-800">Komoditas selesai QC: {highlightKomoditas}</p>
                    <p className="text-emerald-700 text-xs mt-0.5">Pilih baris <span className="font-semibold">{highlightKomoditas}</span> di bawah, lalu klik <span className="font-semibold">+ Produksi Batch</span> untuk buat jadwal produksi.</p>
                  </div>
                  <button onClick={() => setShowQcBanner(false)} className="text-emerald-400 hover:text-emerald-600">
                    <X size={14} />
                  </button>
                </div>
              )}

              {demandPoolList.length > 0 ? (
                <>
                  <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="py-3 px-3 text-xs font-bold text-gray-500 w-10 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                checked={demandPoolList.length > 0 && selectedDemands.length === demandPoolList.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    let totalNet = 0;
                                    demandPoolList.forEach(d => {
                                      totalNet += d.totalKgKurang;
                                    });
                                    if (totalNet > 1000) {
                                      message.warning(`Kapasitas maksimal 1000 kg hasil jadi (net). Total pilihan ${totalNet} kg. Pilih manual.`);
                                      return;
                                    }
                                    setSelectedDemands([...demandPoolList]);
                                  } else {
                                    setSelectedDemands([]);
                                  }
                                }}
                              />
                            </th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500">Komoditas</th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500">Ukuran Kemasan</th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500 text-center">Kekurangan (Pack)</th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500 text-center">Target Produksi (Net)</th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500 text-center">Bahan Baku (Gross)</th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500">Pesanan Terkait</th>
                            <th className="py-3 px-3 text-xs font-bold text-gray-500 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {demandPoolList.map((demand, idx) => {
                            const isSelected = selectedDemands.some(d => d.produkNama === demand.produkNama && d.ukuranKg === demand.ukuranKg);
                            return (
                            <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${
                              isSelected ? 'bg-blue-50/50' : ''
                            } ${
                              highlightKomoditas && demand.produkNama === highlightKomoditas
                                ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-50/30'
                                : ''
                            }`}>
                              <td className="py-4 px-3 text-center">
                                <input 
                                  type="checkbox"
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedDemands(prev => prev.filter(d => !(d.produkNama === demand.produkNama && d.ukuranKg === demand.ukuranKg)));
                                    } else {
                                      let currentNet = 0;
                                      selectedDemands.forEach(d => {
                                        currentNet += d.totalKgKurang;
                                      });
                                      const thisNet = demand.totalKgKurang;
                                      
                                      if (currentNet + thisNet > 1000) {
                                        message.warning(`Kapasitas maksimal 1000 kg hasil jadi (net). Kombinasi mencapai ${currentNet + thisNet} kg.`);
                                        return;
                                      }
                                      setSelectedDemands(prev => [...prev, demand]);
                                    }
                                  }}
                                />
                              </td>
                              <td className="py-4 px-3 font-bold text-gray-900">{demand.produkNama}</td>
                              <td className="py-4 px-3 text-sm text-gray-600 font-medium">
                                {demand.ukuranKg === 0 || demand.ukuranKg === '0' 
                                  ? 'Sayur Segar (Curah)' 
                                  : demand.ukuranKg === 'kombinasi' || demand.ukuranKg === 'kustom'
                                  ? String(demand.ukuranKg).charAt(0).toUpperCase() + String(demand.ukuranKg).slice(1)
                                  : `${demand.ukuranKg} kg`}
                                {demand.keteranganTambahan && (
                                  <div className="text-[10px] text-blue-600 mt-1 font-normal bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block">
                                    {demand.keteranganTambahan}
                                  </div>
                                )}
                              </td>
                          <td className="py-4 px-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                              {demand.totalPackKurang} Pack
                            </span>
                          </td>
                          <td className="py-4 px-3 text-center font-semibold text-gray-700">
                            {demand.totalKgKurang} kg
                          </td>
                          <td className="py-4 px-3 text-center font-bold text-amber-700">
                            {(() => {
                              const loss = { Wortel: 35, Jagung: 70, Buncis: 7 }[demand.produkNama as 'Wortel'|'Jagung'|'Buncis'] || 0;
                              const gross = Math.round(demand.totalKgKurang / (1 - (loss / 100)));
                              return `${gross} kg`;
                            })()}
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex flex-col gap-1.5">
                              {demand.requests?.map((req: any) => (
                                <div key={req.id} className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-1.5 rounded flex flex-col gap-0.5 w-max">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-blue-600 font-bold">#{req.ecommerceId ? req.ecommerceId.split('-')[0] : req.id.split('-')[0]}</span>
                                      <span className="text-slate-500 font-medium">({new Date(req.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'})})</span>
                                    </div>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Apakah Anda yakin ingin membatalkan kebutuhan #${req.ecommerceId || req.id.substring(0,8)} ini?`)) {
                                          try {
                                            const type = req.ecommerceId && (req.ecommerceId.startsWith('MANUAL-') || req.ecommerceId === 'MANUAL') ? 'MANUAL' : 'STORE';
                                            await jadwalProduksiApi.cancelDemand(req.id, type);
                                            message.success('Kebutuhan berhasil dibatalkan');
                                            fetchData();
                                          } catch (err: any) {
                                            message.error(err?.response?.data?.error || 'Gagal membatalkan kebutuhan');
                                          }
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 font-bold text-[9px] hover:underline transition-colors"
                                      title="Batalkan kebutuhan ini"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                  {req.expired && (
                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded inline-block w-max border border-red-100">Exp: {new Date(req.expired).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <button
                              onClick={() => {
                                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                                const loss = YIELD_LOSS_MAP[demand.produkNama] || 0;
                                const requiredGross = Math.round(demand.totalKgKurang / (1 - (loss / 100)));
                                let url = `baru?komoditas=${encodeURIComponent(demand.produkNama)}&volume=${requiredGross}&kemasan=${demand.ukuranKg}`;
                                if (demand.ukuranKg === 'kombinasi' && (demand as any).totalKemasanBesar !== undefined) {
                                  url += `&kombinasiBesar=${(demand as any).totalKemasanBesar}`;
                                }
                                if ((demand as any).estimasiBahanBakuRp) {
                                  url += `&bahanBaku=${(demand as any).estimasiBahanBakuRp}`;
                                }
                                const requestIds = demand.requests?.map((r: any) => r.id) || [];
                                const isManual = demand.requests?.[0]?.ecommerceId && (demand.requests[0].ecommerceId.startsWith('MANUAL-') || demand.requests[0].ecommerceId === 'MANUAL');
                                if (isManual) {
                                  url += `&permintaanId=${requestIds[0] || ''}`;
                                  if (requestIds.length > 0) {
                                    url += `&permintaanIds=${requestIds.join(',')}`;
                                  }
                                } else {
                                  url += `&pengajuanId=${requestIds[0] || ''}`;
                                  if (requestIds.length > 0) {
                                    url += `&pengajuanIds=${requestIds.join(',')}`;
                                  }
                                }
                                navigate(url);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                            >
                              <Plus size={14} /> Produksi Batch
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
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
                        Total Kebutuhan (Net): {selectedDemands.reduce((sum, d) => sum + d.totalKgKurang, 0)} kg | 
                        Estimasi Mentah (Gross): {selectedDemands.reduce((sum, d) => {
                          const loss = { Wortel: 35, Jagung: 70, Buncis: 7 }[d.produkNama as 'Wortel'|'Jagung'|'Buncis'] || 0;
                          return sum + Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                        }, 0)} kg
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors"
                  >
                    Buat Jadwal Gabungan
                  </button>
                </div>
              )}
            </>) : (
            /* Empty state - tidak ada permintaan produksi */
            <div className="bg-white border border-dashed border-blue-200 rounded-2xl p-8 text-center">
              <Package size={36} className="mx-auto mb-3 text-blue-200" />
              <p className="font-semibold text-gray-500">Tidak ada permintaan produksi saat ini</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Permintaan muncul otomatis saat ada pesanan seller yang stoknya belum mencukupi, atau dari permintaan pengadaan manual yang sudah tiba/selesai QC.
              </p>
            </div>
          )}
        </div>
      )}

          {jadwalList.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 p-12 text-center shadow-sm">
          <CalendarDays size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Belum ada jadwal produksi</p>
          <p className="text-sm text-gray-400 mt-1">Buat jadwal baru dari pesanan grosir yang masuk</p>
          <button
            onClick={() => navigate('baru')}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-all"
          >
            <Plus size={15} /> Buat Jadwal Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {jadwalList.map((jadwal) => {
            const cfg = STATUS_CONFIG[jadwal.statusJadwal] || STATUS_CONFIG.DRAFT;
            const persen = jadwal.summary?.persenSelesai ?? 0;
            const isExpired = new Date(jadwal.tenggat) < new Date() && jadwal.statusJadwal === 'AKTIF';
            
            const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
            const loss = YIELD_LOSS_MAP[jadwal.komoditasNama] || 0;
            const netVolume = Math.round(jadwal.volumeTotalKg * (1 - (loss / 100)));

            return (
              <div
                key={jadwal.id}
                onClick={() => navigate(jadwal.id)}
                className={`group cursor-pointer rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all p-5 border-l-4 ${
                  netVolume > 1000 ? 'border-l-red-500' : 'border-l-emerald-500'
                }`}
              >
                {/* Top Row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {isExpired && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-red-700 bg-red-100">
                          <AlertTriangle size={11} /> Tenggat Lewat!
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{jadwal.komoditasNama}</h3>
                  </div>
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 mt-1" />
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
                  <div>
                    <span className="text-gray-400">Volume</span>
                    <p className="font-semibold text-gray-800">
                      {jadwal.volumeTotalKg.toLocaleString('id-ID')} kg (Gross) /{' '}
                      <span className={netVolume > 1000 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                        {netVolume.toLocaleString('id-ID')} kg (Net)
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Tenggat</span>
                    <p className={`font-semibold ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>
                      {formatTanggal(jadwal.tenggat)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Mulai Produksi</span>
                    <p className="font-semibold text-gray-800">{formatTanggal(jadwal.tanggalMulai)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Durasi</span>
                    <p className="font-semibold text-gray-800">{jadwal.estimasiHari} hari</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress Produksi</span>
                    <span className="font-semibold text-emerald-700">{persen}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${persen >= 100 ? 'bg-blue-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(persen, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>
                      {jadwal.summary?.hariSelesai ?? 0}/{jadwal.estimasiHari} hari selesai
                    </span>
                    <span className="text-amber-600 font-medium">
                      Borongan: {formatRupiah(jadwal.summary?.totalBiayaBorongan ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>

      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-600 pb-2 border-b">
            <CheckCircle2 size={24} />
            <span className="text-lg font-bold">Konfirmasi Jadwal Produksi Gabungan</span>
          </div>
        }
        open={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        footer={null}
        width={600}
        centered
        className="rounded-2xl overflow-hidden"
      >
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-2 pb-4">
          {Object.entries(generateResumeData()).map(([nama, data]) => (
            <div key={nama} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-800">{nama}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">HASIL JADI (NET)</p>
                  <p className="text-lg font-bold text-emerald-700">{data.net} kg</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-600 font-semibold mb-1">BAHAN BAKU (GROSS)</p>
                  <p className="text-lg font-bold text-amber-700">{data.gross} kg</p>
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold mb-1">DETAIL KEMASAN</p>
                <div className="text-sm font-medium text-blue-900 flex flex-col gap-0.5 mt-1">
                  {data.packs.map((packStr, idx) => (
                    <div key={idx} className="flex items-center gap-2 before:content-['•'] before:text-blue-400">
                      {packStr}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Ringkasan Total Gabungan */}
          {(() => {
            const resumeData = generateResumeData();
            const totalNetCombined = Object.values(resumeData).reduce((sum, item) => sum + item.net, 0);
            const totalGrossCombined = Object.values(resumeData).reduce((sum, item) => sum + item.gross, 0);
            
            return (
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col gap-2 mt-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Akumulasi Gabungan</h4>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                    <p className="text-[10px] text-emerald-400 font-bold mb-0.5">TOTAL HASIL JADI (NET)</p>
                    <p className="text-xl font-bold text-white">{totalNetCombined} kg</p>
                  </div>
                  <div className="bg-white/10 p-3.5 rounded-xl border border-white/10">
                    <p className="text-[10px] text-amber-400 font-bold mb-0.5">TOTAL BAHAN BAKU (GROSS)</p>
                    <p className="text-xl font-bold text-white">{totalGrossCombined} kg</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Pemilihan Tanggal */}
          <div className="mt-4">
            {!showCalendar ? (
              <button
                onClick={() => setShowCalendar(true)}
                className="w-full py-3 border border-dashed border-emerald-300 rounded-xl text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors flex justify-center items-center gap-2"
              >
                <CalendarDays size={18} />
                Pilih Tanggal Jadwal Produksi (Wajib)
              </button>
            ) : (
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                <div className="flex justify-between items-center mb-2 px-2">
                  <span className="font-semibold text-gray-700">Pilih Tanggal:</span>
                  <button onClick={() => { setShowCalendar(false); setSelectedDate(null); }} className="text-xs text-red-500 font-medium hover:underline">Batal</button>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                  <Calendar 
                    fullscreen={false} 
                    value={selectedDate || dayjs()}
                    onSelect={(date) => setSelectedDate(date)}
                    fullCellRender={(date) => {
                      const listData = jadwalList.filter(j => {
                        if (j.statusJadwal !== 'AKTIF') return false;
                        const valDate = date.toDate();
                        const start = new Date(j.tanggalMulai);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(j.tanggalSelesai);
                        end.setHours(23, 59, 59, 999);
                        return valDate >= start && valDate <= end;
                      });
                      const isSelected = selectedDate && date.isSame(selectedDate, 'day');
                      return (
                        <div className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm cursor-pointer transition-colors ${isSelected ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`}>
                          {date.date()}
                          {listData.length > 0 && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {listData.map((item, i) => {
                                const netVal = getNetVolume(item);
                                return (
                                  <div 
                                    key={i} 
                                    className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : (netVal > 1000 ? 'bg-red-500' : 'bg-emerald-500')}`} 
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 px-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> 
                  Titik merah menandakan jadwal produksi sudah penuh
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => { setShowConfirmModal(false); setShowCalendar(false); setSelectedDate(null); }}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                
                const groups: Record<string, { totalGross: number, packBesar: number }> = {};
                selectedDemands.forEach(d => {
                  const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                  const gross = Math.round(d.totalKgKurang / (1 - (loss / 100)));
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
                  
                  const allRequestIds = demandsForProd.flatMap(d => d.requests || []).map(r => r.id);
                  const allRequests = demandsForProd.flatMap(d => d.requests || []);
                  const isManual = allRequests[0]?.ecommerceId && (allRequests[0].ecommerceId.startsWith('MANUAL-') || allRequests[0].ecommerceId === 'MANUAL');

                  if (isKombinasi) {
                    return {
                      nama,
                      volumeKg: String(data.totalGross),
                      kemasan: 'kombinasi',
                      kemasanKombinasiBesar: String(data.packBesar),
                      permintaanIds: isManual ? allRequestIds : undefined,
                      pengajuanIds: !isManual ? allRequestIds : undefined,
                    };
                  } else {
                    return {
                      nama,
                      volumeKg: String(data.totalGross),
                      kemasan: String(demandsForProd[0].ukuranKg),
                      kemasanKombinasiBesar: '0',
                      permintaanIds: isManual ? allRequestIds : undefined,
                      pengajuanIds: !isManual ? allRequestIds : undefined,
                    };
                  }
                });
                
                setShowConfirmModal(false);
                setShowCalendar(false);
                navigate('baru', { state: { selectedItems, selectedDate: selectedDate ? selectedDate.toISOString() : null } });
              }}
              disabled={!selectedDate}
              className={`px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2 ${!selectedDate ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              <span>Ya, Lanjut Buat Jadwal</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default JadwalProduksiPage;
