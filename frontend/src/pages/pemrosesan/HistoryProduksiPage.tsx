import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { jadwalProduksiApi, JadwalProduksi } from '../../api/jadwal-produksi.api';
import { Loader2, History, PackageCheck, ChevronDown, ChevronUp, DollarSign, Users, X, FileDown, BarChart3, CheckCircle2, Calendar, RotateCcw, Filter } from 'lucide-react';
import { generateLaporanHistoryPDF } from '../../lib/pdfLaporanProduksi';

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatRp = (num: number) => `Rp ${Math.round(num).toLocaleString('id-ID')}`;

const fmtKg = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)} ton` : `${n.toFixed(1)} kg`;

const getBestBefore = (iso: string) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 9);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const HistoryProduksiPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const gudangId = (user?.managedWarehouses as any[])?.[0]?.id || '';

  const [items, setItems] = useState<JadwalProduksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Date Range Filter State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!gudangId) return;
      try {
        const res = await jadwalProduksiApi.getList({ gudangId });
        console.log('fetchHistory res:', res);
        const filtered = res.filter(item => item.statusJadwal === 'SELESAI' || item.statusJadwal === 'BATAL');
        console.log('fetchHistory filtered:', filtered);
        // Sort newest first
        setItems(filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [gudangId]);

  // Filter items by date range
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemDateStr = item.updatedAt || item.createdAt;
      if (!itemDateStr) return true;
      const itemDate = new Date(itemDateStr);

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }
      return true;
    });
  }, [items, startDate, endDate]);

  // Analytics calculation based on filteredItems
  const analytics = useMemo(() => {
    if (!filteredItems || filteredItems.length === 0) return null;

    let totalVolume = 0;
    let totalHpp = 0;
    let totalWorkerPay = 0;
    let workerCount = 0;
    let totalLaporanCount = 0;
    let passedQcCount = 0;

    const commodityMap: Record<string, { weight: number; count: number; passed: number }> = {};

    filteredItems.forEach((item) => {
      totalVolume += Number(item.volumeTotalKg) || 0;

      const laps = item.laporanEksekusi || [];
      laps.forEach((lap: any) => {
        totalLaporanCount++;
        if (lap.lolosSop) passedQcCount++;

        const name = lap.nama || item.komoditasNama || 'Lainnya';
        if (!commodityMap[name]) {
          commodityMap[name] = { weight: 0, count: 0, passed: 0 };
        }
        const weight = Number(lap.hasilPenimbanganAkhir || lap.targetVolumeKg) || 0;
        commodityMap[name].weight += weight;
        commodityMap[name].count += 1;
        if (lap.lolosSop) commodityMap[name].passed += 1;

        if (lap.hppDetail) {
          totalHpp += Number(lap.hppDetail.totalBiaya) || 0;
        }
      });

      if (item.hariProduksi) {
        item.hariProduksi.forEach((hp: any) => {
          (hp.tenagaKerja || []).forEach((tk: any) => {
            totalWorkerPay += Number(tk.totalUpah) || 0;
            workerCount++;
          });
        });
      }
    });

    const sortedCommodities = Object.entries(commodityMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.weight - a.weight);

    const mostProduced = sortedCommodities[0] || { name: '-', weight: 0 };
    const qcPassedPercent = totalLaporanCount > 0 ? Math.round((passedQcCount / totalLaporanCount) * 100) : 100;
    const qcFailedPercent = 100 - qcPassedPercent;

    return {
      totalJadwal: filteredItems.length,
      totalVolume,
      totalHpp,
      totalWorkerPay,
      workerCount,
      mostProduced,
      qcPassedPercent,
      qcFailedPercent,
      totalLaporanCount,
      passedQcCount,
      sortedCommodities,
    };
  }, [filteredItems]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Memuat riwayat produksi...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Riwayat & HPP Produksi</h2>
          <p className="text-xs text-slate-500">Catatan eksekusi produksi yang telah selesai</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => generateLaporanHistoryPDF(filteredItems, { startDate, endDate })}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-3.5 h-3.5" /> Download PDF
          </button>
          <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200">
            {filteredItems.length} / {items.length} Data
          </span>
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
      {analytics && (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-600" />
                Visualisasi & Analisis Produksi
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ringkasan performa eksekusi produksi
                {startDate || endDate ? ` (Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'})` : ''}
              </p>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Volume Produksi</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{fmtKg(analytics.totalVolume)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Akumulasi HPP Biaya</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{formatRp(analytics.totalHpp)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Komoditas Terbanyak</span>
              <p className="text-sm font-bold text-slate-800 truncate mt-2">{analytics.mostProduced.name}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{fmtKg(analytics.mostProduced.weight)}</span>
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
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Perbandingan Volume per Komoditas</h4>
              <div className="space-y-3">
                {analytics.sortedCommodities.map((item, index) => {
                  const percent = analytics.totalVolume > 0 
                    ? Math.round((item.weight / analytics.totalVolume) * 100) 
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

            {/* Chart 2: QC Analysis & Pekerja */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analisis Kelulusan QC & Tenaga Kerja</h4>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-emerald-700">Lolos SOP / QC</span>
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
                    <span className="text-red-700">Reject / Non-SOP</span>
                    <span className="text-red-600 font-bold">{analytics.qcFailedPercent}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all duration-500" 
                      style={{ width: `${analytics.qcFailedPercent}%` }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 font-semibold block">Kinerja Tenaga Kerja</span>
                    <span className="text-slate-700 font-bold">{analytics.workerCount} Pencatatan Pekerja</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-semibold block">Total Upah Borongan</span>
                    <span className="text-emerald-600 font-bold">{formatRp(analytics.totalWorkerPay)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredItems.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <PackageCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Belum ada riwayat produksi pada periode ini</p>
          <p className="text-xs text-slate-400 mt-1">Ubah rentang tanggal filter untuk melihat riwayat produksi lainnya</p>
        </div>
      )}

      <div className="grid gap-4">
        {filteredItems.map((item) => {
          const isExpanded = expandedId === item.id;
          const laporan = item.laporanEksekusi || [];
          const tglSelesai = item.updatedAt || item.createdAt;

          return (
            <div key={item.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all">
              {/* Card Header (Clickable) */}
              <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                    {item.komoditasNama}
                    {item.statusJadwal === 'SELESAI' ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">Selesai</span>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">Batal</span>
                    )}
                  </h4>
                  <div className="flex flex-wrap items-center gap-4 mt-1.5">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <History className="w-3.5 h-3.5" />
                      {formatTanggal(tglSelesai as string)}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 border-l border-slate-300 pl-4">
                      Total Volume: {item.volumeTotalKg.toLocaleString('id-ID')} Kg
                    </span>
                    <span className="text-xs font-semibold text-red-600 border-l border-slate-300 pl-4">
                      Baik Digunakan Sebelum: {getBestBefore(tglSelesai as string)}
                    </span>
                  </div>
                </div>
                <div className="text-slate-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* Card Body (Expanded) */}
              {isExpanded && (
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                  {item.statusJadwal === 'BATAL' ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center shadow-sm">
                      <p className="text-sm font-bold text-red-800">Jadwal Produksi Dibatalkan</p>
                      {item.catatanJadwal ? (
                        <p className="text-xs text-red-600 mt-2 bg-white/60 py-1.5 px-3 rounded border border-red-100/50 inline-block">
                          Alasan: <strong>{item.catatanJadwal}</strong>
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 mt-1 italic">Tidak ada catatan alasan pembatalan.</p>
                      )}
                    </div>
                  ) : Array.isArray(laporan) && laporan.length > 0 ? (
                    laporan.map((lap: any, idx: number) => {
                      const hpp = lap.hppDetail;
                      const pekerjaKomoditas = item.hariProduksi
                        ? item.hariProduksi
                            .flatMap((hp) => hp.tenagaKerja || [])
                            .filter((tk) => tk.catatan === lap.nama)
                        : [];

                      return (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                            <span className="font-bold text-sm text-slate-800">{lap.nama}</span>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${lap.lolosSop ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {lap.lolosSop ? 'Lolos QC' : 'Reject QC'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-[10px] text-slate-500 font-semibold">Target Volume</p>
                              <p className="text-xs font-bold text-slate-800">{lap.targetVolumeKg} Kg</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-semibold">Penimbangan Akhir</p>
                              <p className="text-xs font-bold text-emerald-700">{lap.hasilPenimbanganAkhir} Kg</p>
                            </div>
                            {lap.catatanQc && (
                              <div className="col-span-2">
                                <p className="text-[10px] text-slate-500 font-semibold">Catatan QC</p>
                                <p className="text-xs text-red-600">{lap.catatanQc}</p>
                              </div>
                            )}
                          </div>

                          {lap.lolosSop && hpp && (
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
                              <h5 className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                                <DollarSign className="w-3.5 h-3.5" /> Rincian Kalkulator HPP
                              </h5>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Bahan Baku</p>
                                  <p className="text-xs font-bold text-emerald-900">{formatRp(hpp.bahanBaku || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Tenaga Kerja</p>
                                  <p className="text-xs font-bold text-emerald-900">{formatRp(hpp.tenagaKerja || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Kemasan</p>
                                  <p className="text-xs font-bold text-emerald-900">{formatRp(hpp.kemasan || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Bhn Lainnya</p>
                                  <p className="text-xs font-bold text-emerald-900">{formatRp(hpp.bahanLain || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Overhead</p>
                                  <p className="text-xs font-bold text-emerald-900">{formatRp(hpp.overhead || 0)}</p>
                                </div>
                              </div>
                              <div className="flex justify-between items-center bg-white p-2 rounded-md border border-emerald-100">
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Total Biaya</p>
                                  <p className="text-sm font-bold text-emerald-900">{formatRp(hpp.totalBiaya || 0)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">Output Kemasan</p>
                                  <p className="text-sm font-bold text-emerald-900 text-center">{hpp.outputKg || 0} Kg</p>
                                </div>
                                <div className="text-right border-l border-emerald-100 pl-3">
                                  <p className="text-[10px] text-emerald-600/70 font-semibold">HPP per Kg</p>
                                  <p className="text-base font-black text-emerald-700">{formatRp(hpp.hppPerKg || 0)}</p>
                                </div>
                              </div>
                              {hpp.hargaJual > 0 && (
                                <div className="mt-2 bg-emerald-700 text-white p-2 rounded-md flex justify-between items-center">
                                  <div>
                                    <p className="text-[10px] text-emerald-200 font-semibold">Target Harga Jual</p>
                                    <p className="text-sm font-bold">{formatRp(hpp.hargaJual)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] text-emerald-200 font-semibold">Margin Didapat</p>
                                    <p className="text-sm font-bold">{formatRp(hpp.marginRp || 0)} <span className="text-emerald-300 text-xs font-normal">({(hpp.marginPersen || 0).toFixed(1)}%)</span></p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Kinerja Pekerja */}
                          {pekerjaKomoditas.length > 0 && (
                            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                              <h5 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                                <Users className="w-3.5 h-3.5 text-slate-500" /> Pencatatan Kinerja Pekerja ({lap.nama})
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {pekerjaKomoditas.map((tk: any, tkIdx: number) => (
                                  <div key={tkIdx} className="bg-white border border-slate-150 rounded-md p-2 flex justify-between items-center text-xs shadow-sm">
                                    <div>
                                      <p className="font-bold text-slate-800">{tk.namaPekerja}</p>
                                      <p className="text-[10px] text-slate-500 font-medium">Tarif: {formatRp(tk.tarifPerKg)}/kg</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-extrabold text-slate-700">{tk.kgDikerjakan} Kg</p>
                                      <p className="text-[10px] font-bold text-emerald-600">{formatRp(tk.totalUpah)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {lap.fotoBukti && (
                            <div className="mt-3">
                              <p className="text-[10px] text-slate-500 font-semibold mb-1">Bukti Foto</p>
                              <img 
                                src={lap.fotoBukti} 
                                alt="Bukti" 
                                className="h-20 w-20 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                                onClick={() => setSelectedImage(lap.fotoBukti)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4">Data eksekusi tidak tersedia.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal View Image */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute top-4 right-4 text-white bg-black/60 hover:bg-black/80 p-2 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selectedImage} alt="Bukti Foto Produksi" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryProduksiPage;
