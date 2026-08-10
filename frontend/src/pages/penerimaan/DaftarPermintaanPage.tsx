import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Send, Package,
  Loader2,
  Users,
  Archive, RefreshCw, CheckCircle2, Truck, MapPin, ClipboardCheck, X, ListChecks, BarChart3, FileDown, RotateCcw, Filter
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { generateLaporanPengadaanPDF } from '../../lib/pdfLaporanPengadaan';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api');

const fmtKg = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)} ton` : `${n.toFixed(1)} kg`;
const fmtRp = (n: number) => n >= 1_000_000
  ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : `Rp ${n.toLocaleString('id-ID')}`;

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600 border-gray-200', step: 0 },
  MENUNGGU_PEMASOK: { label: 'Menunggu Pemasok', color: 'bg-amber-50 text-amber-700 border-amber-200', step: 0 },
  TERKIRIM: { label: 'Terkirim', color: 'bg-blue-50 text-blue-700 border-blue-200', step: 1 },
  TIBA: { label: 'Tiba di Gudang', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', step: 2 },
  SELESAI_QC: { label: 'Selesai QC', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', step: 3 },
};

const TRACKING_STEPS = [
  { key: 'TERKIRIM', label: 'Terkirim' },
  { key: 'TIBA', label: 'Tiba' },
  { key: 'SELESAI_QC', label: 'Selesai QC' }
];

const getOrderColor = (orderId: string | null) => {
  if (!orderId) return 'bg-gray-100 text-gray-500 border-gray-200';
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = orderId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-blue-50 text-blue-600 border-blue-200',
    'bg-purple-50 text-purple-600 border-purple-200',
    'bg-pink-50 text-pink-600 border-pink-200',
    'bg-amber-50 text-amber-600 border-amber-200',
    'bg-indigo-50 text-indigo-600 border-indigo-200',
    'bg-teal-50 text-teal-600 border-teal-200',
    'bg-rose-50 text-rose-600 border-rose-200',
    'bg-cyan-50 text-cyan-600 border-cyan-200',
  ];
  return colors[Math.abs(hash) % colors.length];
};

interface PermintaanPengadaan {
  id: string;
  komoditasNama: string;
  targetKg: number;
  totalKomitmenKg: number;
  jumlahKepalaPetaniRespon: number;
  hargaAcuanPerKg: number | null;
  deadlinePanen: string | null;
  trendPersen: number | null;
  trendArah: string | null;
  status: string;
  periode: string;
  createdAt: string;
  nomorOrder?: string | null;
  tipePesanan?: string;
  sumberOrderId?: string | null;
  tanggalTiba?: string | null;
  qcDetail?: any;
  rencanaProduksi?: any;
}

const DaftarPermintaanPage: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const [myGudangId, setMyGudangId] = useState<string | null>(null);
  const [permintaanList, setPermintaanList] = useState<PermintaanPengadaan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Date Range Filter State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // QC Modal State
  const [qcModalOpen, setQcModalOpen] = useState(false);
  const [qcItem, setQcItem] = useState<PermintaanPengadaan | null>(null);
  const [nomorOrder, setNomorOrder] = useState('');
  const [formQc, setFormQc] = useState({
    beratAktual: '',
    beratSesuai: 'ya',
    beratTidakLolos: '',
    busuk: false,
    cacing: false,
    lendir: false,
    hancur: false,
    fotoQc: '',
  });

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<PermintaanPengadaan | null>(null);

  useEffect(() => {
    if (user?.managedWarehouses && user.managedWarehouses.length > 0) {
      setMyGudangId(user.managedWarehouses[0].id);
    }
  }, [user]);

  const fetchPermintaanList = async () => {
    if (!myGudangId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/permintaan-pengadaan`, {
        params: { gudangId: myGudangId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setPermintaanList(res.data?.data || []);
    } catch (err) {
      console.error('Gagal ambil permintaan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (myGudangId) {
      fetchPermintaanList();
    }
  }, [myGudangId]);

  // Filter items by date range
  const filteredPermintaanList = React.useMemo(() => {
    return permintaanList.filter((p) => {
      const pDateStr = p.tanggalTiba || p.createdAt;
      if (!pDateStr) return true;
      const pDate = new Date(pDateStr);

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (pDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (pDate > end) return false;
      }
      return true;
    });
  }, [permintaanList, startDate, endDate]);

  const getAnalytics = () => {
    const totalOrders = filteredPermintaanList.length;
    const totalWeight = filteredPermintaanList.reduce((sum, p) => sum + (Number(p.targetKg) || 0), 0);
    
    const commodityGroups: Record<string, number> = {};
    let totalQcTarget = 0;
    let totalQcFailed = 0;
    
    filteredPermintaanList.forEach(p => {
      const name = p.komoditasNama || 'Lainnya';
      const target = Number(p.targetKg) || 0;
      commodityGroups[name] = (commodityGroups[name] || 0) + target;
      
      if (p.qcDetail) {
        totalQcTarget += target;
        totalQcFailed += Number(p.qcDetail.beratTidakLolos) || 0;
      }
    });
    
    const sortedCommodities = Object.entries(commodityGroups)
      .map(([name, weight]) => ({ name, weight }))
      .sort((a, b) => b.weight - a.weight);
      
    const mostOrdered = sortedCommodities[0] || { name: '-', weight: 0 };
    
    const qcFailedPercent = totalQcTarget > 0 
      ? Math.round((totalQcFailed / totalQcTarget) * 100) 
      : 0;
      
    const qcPassedPercent = 100 - qcFailedPercent;
    
    return {
      totalOrders,
      totalWeight,
      sortedCommodities,
      mostOrdered,
      totalQcFailed,
      totalQcTarget,
      qcFailedPercent,
      qcPassedPercent
    };
  };

  // Quick Date Presets
  const setThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(todayStr);
  };

  const setLast30Days = () => {
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 30);
    setStartDate(past.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  const resetFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleKirim = async (id: string) => {
    setLoadingAction(id);
    try {
      await axios.post(`${API}/permintaan-pengadaan/${id}/kirim`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPermintaanList();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal mengirim');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setLoadingAction(id);
    try {
      await axios.patch(`${API}/permintaan-pengadaan/${id}/status-tracking`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPermintaanList();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal update status');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExpire = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menandai pesanan ini sebagai KADALUARSA?")) return;
    setLoadingAction(id);
    try {
      await axios.post(`${API}/permintaan-pengadaan/${id}/expire`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPermintaanList();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menandai kadaluarsa');
    } finally {
      setLoadingAction(null);
    }
  };

  const openQcModal = (item: PermintaanPengadaan) => {
    setNomorOrder(item.nomorOrder || `ORD-LGCY-${Math.floor(1000 + Math.random() * 9000)}`);
    setQcItem(item);
    setFormQc({
      beratAktual: '',
      beratSesuai: 'ya',
      beratTidakLolos: '',
      busuk: false,
      cacing: false,
      lendir: false,
      hancur: false,
      fotoQc: '',
    });
    setQcModalOpen(true);
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
      if (file.size > MAX_SIZE) {
        alert('Ukuran file terlalu besar! Maksimal ukuran foto adalah 5 MB.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormQc({ ...formQc, fotoQc: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const openHistoryModal = (item: PermintaanPengadaan) => {
    setHistoryItem(item);
    setHistoryModalOpen(true);
  };

  const handleSubmitQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcItem) return;
    setLoadingAction('qc');
    try {
      const checklist = [];
      if (formQc.busuk) checklist.push('Busuk');
      if (formQc.cacing) checklist.push('Cacing');
      if (formQc.lendir) checklist.push('Lendir');
      if (formQc.hancur) checklist.push('Hancur');

      await axios.post(`${API}/permintaan-pengadaan/${qcItem.id}/qc-selesai`, {
        nomorOrder,
        tanggal: new Date().toISOString(),
        komoditasNama: qcItem.komoditasNama,
        beratAktual: parseFloat(formQc.beratAktual) || 0,
        beratSesuai: formQc.beratSesuai === 'ya',
        beratTidakLolos: formQc.beratSesuai === 'tidak' ? parseFloat(formQc.beratTidakLolos) || 0 : 0,
        checklist,
        fotoQc: formQc.fotoQc,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQcModalOpen(false);
      fetchPermintaanList();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal submit QC');
    } finally {
      setLoadingAction(null);
    }
  };

  const renderTracker = (status: string) => {
    const currentIndex = TRACKING_STEPS.findIndex(s => s.key === status);
    if (currentIndex === -1) return null; // Only render for tracked steps

    return (
      <div className="mt-6 mb-2 px-2">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 rounded-full"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(currentIndex / (TRACKING_STEPS.length - 1)) * 100}%` }}
          ></div>
          
          {TRACKING_STEPS.map((step, idx) => {
            const isCompleted = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            
            let Icon = CheckCircle2;
            if (idx === 0) Icon = Send;
            if (idx === 1) Icon = Users;
            if (idx === 2) Icon = Truck;
            if (idx === 3) Icon = MapPin;
            if (idx === 4) Icon = ClipboardCheck;

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-300'
                } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}>
                  <Icon size={14} />
                </div>
                <span className={`text-[10px] font-bold absolute -bottom-5 w-24 text-center ${
                  isCurrent ? 'text-emerald-700' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActionButton = (pp: PermintaanPengadaan) => {
    const isExpired = pp.tanggalTiba && new Date(new Date(pp.tanggalTiba).getTime() + 3 * 24 * 60 * 60 * 1000) < new Date();
    const canExpire = isExpired && !['KADALUARSA', 'DIBATALKAN', 'SELESAI_QC', 'TERPENUHI'].includes(pp.status);

    let mainAction = null;

    if (pp.status === 'DRAFT') {
      mainAction = (
        <button
          onClick={() => handleKirim(pp.id)}
          disabled={loadingAction === pp.id}
          className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-60 flex-shrink-0 shadow-lg shadow-emerald-100"
        >
          {loadingAction === pp.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Kirim ke Petani
        </button>
      );
    } else if (pp.status === 'TERKIRIM') {
      mainAction = (
        <button
          onClick={() => handleUpdateStatus(pp.id, 'TIBA')}
          disabled={loadingAction === pp.id}
          className="flex items-center gap-1.5 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-fuchsia-100 transition-colors flex-shrink-0"
        >
          {loadingAction === pp.id ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
          Konfirmasi Tiba
        </button>
      );
    } else if (pp.status === 'TIBA') {
      mainAction = (
        <button
          onClick={() => openQcModal(pp)}
          className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-colors flex-shrink-0"
        >
          <ClipboardCheck size={13} />
          Proses QC & Selesai
        </button>
      );
    } else if (pp.status === 'SELESAI_QC') {
      mainAction = (
        <div className="flex flex-col gap-2 items-end">
          {/* Lanjutkan ke Demand Pool */}
          <button
            onClick={() => {
              const prefix = user?.peran === 'ADMIN_GUDANG' ? '/kepala-gudang' : '/staf';
              navigate(`${prefix}/pemrosesan/jadwal-produksi`, {
                state: { highlightKomoditas: pp.komoditasNama, fromQC: true, permintaanId: pp.id }
              });
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs px-3 py-2 rounded-xl shadow-md shadow-emerald-100 transition-all active:scale-[0.98] flex-shrink-0"
          >
            <ListChecks size={13} />
            Lanjutkan ke Demand Pool
          </button>
          <button
            onClick={() => openHistoryModal(pp)}
            className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors flex-shrink-0"
          >
            <ClipboardCheck size={13} />
            Lihat Riwayat QC
          </button>
        </div>
      );
    } else if (pp.status === 'KADALUARSA') {
      mainAction = (
        <button
          onClick={() => openHistoryModal(pp)}
          className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors flex-shrink-0"
        >
          <ClipboardCheck size={13} />
          Lihat Riwayat
        </button>
      );
    }

    if (!mainAction && !canExpire) return null;

    return (
      <div className="flex flex-col gap-2 items-end">
        {mainAction}
        {canExpire && (
          <button
            onClick={() => handleExpire(pp.id)}
            disabled={loadingAction === pp.id}
            className="flex items-center gap-1.5 bg-red-600 text-white font-bold text-xs px-3 py-2 rounded-xl hover:bg-red-700 disabled:opacity-60 flex-shrink-0 shadow-lg shadow-red-100"
          >
            {loadingAction === pp.id ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
            Tandai Kadaluarsa
          </button>
        )}
      </div>
    );
  };

  const analytics = getAnalytics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Archive size={24} className="text-emerald-600" />
            Riwayat Permintaan Pengadaan
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Daftar seluruh permintaan pengadaan komoditas dan status *tracking*-nya.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateLaporanPengadaanPDF(filteredPermintaanList as any, { startDate, endDate })}
            disabled={filteredPermintaanList.length === 0}
            className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown size={13} /> Download PDF
          </button>
          <button
            onClick={fetchPermintaanList}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
          <Filter size={15} className="text-emerald-600" />
          <span>Filter Periode Tanggal:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-slate-400 font-medium">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-slate-400 font-medium">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <button
              onClick={setThisMonth}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors"
            >
              Bulan Ini
            </button>
            <button
              onClick={setLast30Days}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-colors"
            >
              30 Hari Terakhir
            </button>
            {(startDate || endDate) && (
              <button
                onClick={resetFilter}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 font-medium flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {filteredPermintaanList.length > 0 && (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-600" />
                Laporan & Analisis Pengadaan
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Analisis pesanan dan tingkat kelulusan Quality Control (QC)
                {startDate || endDate ? ` (Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'})` : ''}
              </p>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Permintaan</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{analytics.totalOrders} Pesanan</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Volume Order</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{fmtKg(analytics.totalWeight)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Komoditas Terbanyak</span>
              <p className="text-sm font-bold text-slate-800 truncate mt-2">{analytics.mostOrdered.name}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{fmtKg(analytics.mostOrdered.weight)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tingkat Kelulusan QC</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">{analytics.qcPassedPercent}%</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Chart 1: Commodity Comparison */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Perbandingan Volume per Komoditas</h3>
              <div className="space-y-3">
                {analytics.sortedCommodities.map((item, index) => {
                  const percent = analytics.totalWeight > 0 
                    ? Math.round((item.weight / analytics.totalWeight) * 100) 
                    : 0;
                  const barColors = [
                    'bg-emerald-500',
                    'bg-blue-500',
                    'bg-indigo-500',
                    'bg-amber-500',
                    'bg-pink-500'
                  ];
                  const colorClass = barColors[index % barColors.length];

                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-slate-700">{item.name}</span>
                        <span className="text-slate-400">{fmtKg(item.weight)} ({percent}%)</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${colorClass}`} 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: QC Outcomes */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analisis Kelulusan Quality Control</h3>
              {analytics.totalQcTarget > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-emerald-700">Lolos QC</span>
                      <span className="text-emerald-600 font-bold">{analytics.qcPassedPercent}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${analytics.qcPassedPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-red-700">Tidak Lolos QC</span>
                      <span className="text-red-600 font-bold">{analytics.qcFailedPercent}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full transition-all duration-500" 
                        style={{ width: `${analytics.qcFailedPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    Dari total <strong className="text-slate-700">{fmtKg(analytics.totalQcTarget)}</strong> berat komoditas yang di-QC, sebanyak <strong className="text-red-600">{fmtKg(analytics.totalQcFailed)}</strong> tidak lolos inspeksi karena rusak/busuk.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[140px] bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-center p-4">
                  <ClipboardCheck size={24} className="text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Belum ada data Quality Control</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Statistik kelulusan QC akan tampil setelah pengajuan diselesaikan oleh QC.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-emerald-500" />
          </div>
        ) : filteredPermintaanList.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
            <Package size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm">Belum ada riwayat permintaan pengadaan pada periode ini.</p>
            <p className="text-xs text-gray-400 mt-1">Ubah rentang tanggal filter untuk melihat riwayat pengadaan lainnya.</p>
          </div>
        ) : (
          Object.entries(
            filteredPermintaanList.reduce((acc, curr) => {
              const key = curr.nomorOrder || `single-${curr.id}`;
              if (!acc[key]) acc[key] = [];
              acc[key].push(curr);
              return acc;
            }, {} as Record<string, typeof permintaanList>)
          ).map(([key, groupItems]) => {
            const isBatch = groupItems.length > 1;

            if (!isBatch) {
              const pp = groupItems[0];
              const cfg = STATUS_CONFIG[pp.status] || STATUS_CONFIG.DRAFT;
              
              return (
                <div key={pp.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-4">
                  <div className="p-5 pb-8">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-gray-50 text-gray-500">
                            {pp.tipePesanan === 'SELLER' ? `Pesanan Seller (No: ${pp.sumberOrderId ? pp.sumberOrderId.substring(0,8) : '-'})` : 'Pesanan Manual'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <h3 className="font-bold text-gray-800 text-lg">{pp.komoditasNama}</h3>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                          <span>Target Pesanan: <strong className="text-gray-800">{fmtKg(pp.targetKg)}</strong></span>
                          {pp.hargaAcuanPerKg && (
                            <>
                              <span>Harga Acuan: <strong className="text-gray-800">{fmtRp(pp.hargaAcuanPerKg)}/kg</strong></span>
                              <span>Estimasi Biaya: <strong className="text-blue-700">{fmtRp(pp.targetKg * pp.hargaAcuanPerKg)}</strong></span>
                            </>
                          )}
                          <span>Tanggal Order: <strong className="text-gray-800">{new Date(pp.createdAt).toLocaleDateString('id-ID')}</strong></span>
                          {pp.tanggalTiba ? (
                             <span className="flex items-center gap-4">
                               <span>Tanggal Tiba: <strong className="text-gray-800">{new Date(pp.tanggalTiba).toLocaleDateString('id-ID')}</strong></span>
                               <span>Expired: <strong className="text-red-600">{new Date(new Date(pp.tanggalTiba).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')}</strong></span>
                             </span>
                          ) : pp.deadlinePanen ? (
                             <span>Tenggat: <strong className="text-gray-800">{new Date(pp.deadlinePanen).toLocaleDateString('id-ID')}</strong></span>
                          ) : null}
                        </div>
                      </div>
                      {renderActionButton(pp)}
                    </div>
                    {/* Order Tracker */}
                    {pp.status !== 'DRAFT' && pp.status !== 'DIBATALKAN' && renderTracker(pp.status)}
                  </div>
                </div>
              );
            }

            const containerBg = getOrderColor(key).split(' ')[0];
            const containerBorder = getOrderColor(key).split(' ')[2];

            return (
              <div key={key} className={`rounded-3xl border overflow-hidden shadow-sm mb-4 ${containerBg} ${containerBorder}`}>
                {/* Header Batch */}
                <div className={`px-6 py-4 flex items-center justify-between border-b bg-white/40 ${containerBorder}`}>
                  <div className="flex items-center gap-3">
                     <span className="font-bold text-gray-800 flex items-center gap-2">
                       <Package size={16} /> Group Order
                     </span>
                     <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-white ${getOrderColor(key)}`}>
                       ID: {key}
                     </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{groupItems.length} Komoditas</span>
                </div>
                
                <div className="p-3 space-y-3">
                  {groupItems.map(pp => {
                    const cfg = STATUS_CONFIG[pp.status] || STATUS_CONFIG.DRAFT;

                    return (
                      <div key={pp.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-white/60">
                        <div className="p-5 pb-8">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-gray-50 text-gray-500">
                                  {pp.tipePesanan === 'SELLER' ? `Pesanan Seller (No: ${pp.sumberOrderId ? pp.sumberOrderId.substring(0,8) : '-'})` : 'Pesanan Manual'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                <h3 className="font-bold text-gray-800 text-lg">{pp.komoditasNama}</h3>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                                <span>Target Pesanan: <strong className="text-gray-800">{fmtKg(pp.targetKg)}</strong></span>
                                {pp.hargaAcuanPerKg && (
                                  <>
                                    <span>Harga Acuan: <strong className="text-gray-800">{fmtRp(pp.hargaAcuanPerKg)}/kg</strong></span>
                                    <span>Estimasi Biaya: <strong className="text-blue-700">{fmtRp(pp.targetKg * pp.hargaAcuanPerKg)}</strong></span>
                                  </>
                                )}
                                <span>Tanggal Order: <strong className="text-gray-800">{new Date(pp.createdAt).toLocaleDateString('id-ID')}</strong></span>
                                {pp.tanggalTiba ? (
                                   <span className="flex items-center gap-4">
                                     <span>Tanggal Tiba: <strong className="text-gray-800">{new Date(pp.tanggalTiba).toLocaleDateString('id-ID')}</strong></span>
                                     <span>Expired: <strong className="text-red-600">{new Date(new Date(pp.tanggalTiba).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')}</strong></span>
                                   </span>
                                ) : pp.deadlinePanen ? (
                                   <span>Tenggat: <strong className="text-gray-800">{new Date(pp.deadlinePanen).toLocaleDateString('id-ID')}</strong></span>
                                ) : null}
                              </div>
                            </div>
                            {renderActionButton(pp)}
                          </div>
                          {/* Order Tracker */}
                          {pp.status !== 'DRAFT' && pp.status !== 'DIBATALKAN' && renderTracker(pp.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* QC Modal */}
      {qcModalOpen && qcItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setQcModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setQcModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:bg-gray-100 p-1.5 rounded-full">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Proses Quality Control (QC)</h3>
                <p className="text-xs text-gray-500">Konfirmasi kesesuaian barang pesanan tiba.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitQc} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Nomor Order</p>
                  <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">{nomorOrder}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Tanggal</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">{new Date().toLocaleDateString('id-ID')}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Komoditas & Target Pesanan</p>
                  <p className="text-base font-bold text-gray-800 mt-0.5">{qcItem.komoditasNama} <span className="text-emerald-600 font-black ml-2">{fmtKg(qcItem.targetKg)}</span></p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Berat Komoditas Aktual (kg)</label>
                <input 
                  type="number" step="0.1" min="0" required
                  value={formQc.beratAktual}
                  onChange={e => setFormQc({...formQc, beratAktual: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder={`Contoh: ${qcItem.targetKg}`}
                />
                {formQc.beratAktual && parseFloat(formQc.beratAktual) < qcItem.targetKg && (
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    Selisih: {fmtKg(qcItem.targetKg - parseFloat(formQc.beratAktual))} Kurang dari target
                  </p>
                )}
                {formQc.beratAktual && parseFloat(formQc.beratAktual) > qcItem.targetKg && (
                  <p className="text-xs text-amber-600 font-semibold mt-1">
                    Selisih: {fmtKg(parseFloat(formQc.beratAktual) - qcItem.targetKg)} Lebih dari target
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">apakah terdapat sayuran reject?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="beratSesuai" value="ya" checked={formQc.beratSesuai === 'ya'} onChange={() => setFormQc({...formQc, beratSesuai: 'ya'})} className="accent-emerald-600" />
                    <span className="text-sm text-gray-700 font-medium">Tidak</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="beratSesuai" value="tidak" checked={formQc.beratSesuai === 'tidak'} onChange={() => setFormQc({...formQc, beratSesuai: 'tidak'})} className="accent-emerald-600" />
                    <span className="text-sm text-gray-700 font-medium">Ya</span>
                  </label>
                </div>
              </div>

              {formQc.beratSesuai === 'tidak' && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-xs font-bold text-red-800 mb-1">Berat Komoditas yang TIDAK Lolos QC (kg)</label>
                    <input 
                      type="number" step="0.1" min="0" required
                      value={formQc.beratTidakLolos}
                      onChange={e => setFormQc({...formQc, beratTidakLolos: e.target.value})}
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="Contoh: 15.5"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-red-800 mb-2">Checklist Penyebab (Pilih yang sesuai):</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 cursor-pointer hover:bg-red-50 transition-colors">
                        <input type="checkbox" checked={formQc.busuk} onChange={e => setFormQc({...formQc, busuk: e.target.checked})} className="accent-red-500 rounded" />
                        <span className="text-xs font-semibold text-gray-700">Terdapat Busuk</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 cursor-pointer hover:bg-red-50 transition-colors">
                        <input type="checkbox" checked={formQc.cacing} onChange={e => setFormQc({...formQc, cacing: e.target.checked})} className="accent-red-500 rounded" />
                        <span className="text-xs font-semibold text-gray-700">Terdapat Cacing</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 cursor-pointer hover:bg-red-50 transition-colors">
                        <input type="checkbox" checked={formQc.lendir} onChange={e => setFormQc({...formQc, lendir: e.target.checked})} className="accent-red-500 rounded" />
                        <span className="text-xs font-semibold text-gray-700">Terdapat Lendir</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-red-100 cursor-pointer hover:bg-red-50 transition-colors">
                        <input type="checkbox" checked={formQc.hancur} onChange={e => setFormQc({...formQc, hancur: e.target.checked})} className="accent-red-500 rounded" />
                        <span className="text-xs font-semibold text-gray-700">Sayur Hancur</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Foto Section */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-700">Upload Foto Bukti QC</label>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Maks. 5 MB (JPG/PNG/WEBP)
                  </span>
                </div>
                {!formQc.fotoQc ? (
                  <div className="flex flex-col gap-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Ukuran berkas foto yang diunggah tidak boleh melebihi 5 MB.</p>
                  </div>
                ) : (
                  <div className="relative inline-block mt-2 group">
                    <img src={formQc.fotoQc} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setFormQc({ ...formQc, fotoQc: '' })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-md transition-colors"
                      title="Hapus Foto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setQcModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={loadingAction === 'qc'} className="px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-lg shadow-emerald-100 disabled:opacity-60 flex items-center gap-2">
                  {loadingAction === 'qc' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Selesaikan Pesanan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setHistoryModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setHistoryModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:bg-gray-100 p-1.5 rounded-full">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Riwayat Detail QC</h3>
                <p className="text-xs text-gray-500">Detail pesanan yang telah selesai</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Nomor Order</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{historyItem.qcDetail?.nomorOrder || '-'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Tanggal Selesai</p>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5">
                    {historyItem.qcDetail?.tanggal ? new Date(historyItem.qcDetail.tanggal).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                  <p className="text-[10px] font-bold text-red-500 uppercase">Tanggal Expired</p>
                  <p className="text-sm font-bold text-red-600 mt-0.5">
                    {(historyItem.tanggalTiba || historyItem.qcDetail?.tanggal) ? new Date(new Date(historyItem.tanggalTiba || historyItem.qcDetail?.tanggal).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Komoditas & Target</p>
                <p className="text-base font-bold text-gray-800 mt-0.5">{historyItem.komoditasNama} <span className="text-emerald-600 font-black ml-2">{fmtKg(historyItem.targetKg)}</span></p>
                
                {historyItem.rencanaProduksi && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 text-xs font-semibold">Target Hasil Produksi</span>
                      <span className="font-bold text-gray-800">{fmtKg(parseFloat((historyItem.rencanaProduksi as any).targetProduksiKg) || 0)}</span>
                    </div>
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-gray-500 text-xs font-semibold mt-0.5">Rencana Kemasan</span>
                      <span className="font-bold text-gray-800 text-right">
                        {(historyItem.rencanaProduksi as any).kemasan === 'kombinasi' 
                          ? `2.5kg: ${(historyItem.rencanaProduksi as any).kemasanKombinasiBesar || 0} pack | 1kg: ${(historyItem.rencanaProduksi as any).kemasanKombinasiKecil || 0} pack`
                          : (historyItem.rencanaProduksi as any).kemasan === 'kustom'
                          ? `${(historyItem.rencanaProduksi as any).kemasanKustom} kg`
                          : `${(historyItem.rencanaProduksi as any).kemasan} kg`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3">
                <h4 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Hasil Pemeriksaan QC</h4>
                
                {historyItem.qcDetail?.beratAktual !== undefined && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Berat Aktual Diterima</span>
                    <span className="font-bold text-gray-800">{fmtKg(historyItem.qcDetail.beratAktual)}</span>
                  </div>
                )}
                {historyItem.qcDetail?.beratAktual !== undefined && historyItem.qcDetail.beratAktual < historyItem.targetKg && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Selisih Kekurangan</span>
                    <span className="font-bold text-red-600">{fmtKg(historyItem.targetKg - historyItem.qcDetail.beratAktual)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Kesesuaian Kondisi</span>
                  <span className={`font-bold ${historyItem.qcDetail?.beratSesuai ? 'text-emerald-600' : 'text-red-600'}`}>
                    {historyItem.qcDetail?.beratSesuai ? 'Sesuai' : 'Tidak Sesuai / Rusak'}
                  </span>
                </div>
                
                {!historyItem.qcDetail?.beratSesuai && historyItem.qcDetail?.beratTidakLolos > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Berat Tidak Lolos QC</span>
                    <span className="font-bold text-red-600">{historyItem.qcDetail.beratTidakLolos} kg</span>
                  </div>
                )}

                {historyItem.qcDetail?.checklist && historyItem.qcDetail.checklist.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 font-semibold block mb-1">Daftar Masalah Ditemukan:</span>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {historyItem.qcDetail.checklist.map((item: string, idx: number) => (
                        <span key={idx} className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-bold border border-red-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {historyItem.qcDetail?.beratAktual !== undefined && (
                  <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-100">
                    <span className="text-emerald-700 font-bold">Berat Lolos QC</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      {fmtKg(historyItem.qcDetail.beratAktual - (historyItem.qcDetail.beratTidakLolos || 0))}
                    </span>
                  </div>
                )}
              </div>

              {historyItem.qcDetail?.fotoQc && (
                <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                  <h4 className="text-sm font-bold text-gray-800 mb-2">Foto Bukti QC</h4>
                  <img src={historyItem.qcDetail.fotoQc} alt="Foto QC" className="w-full h-auto rounded-lg border border-gray-200" />
                </div>
              )}
            </div>

            <div className="mt-6 text-right">
              <button onClick={() => setHistoryModalOpen(false)} className="px-5 py-2 text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaftarPermintaanPage;

