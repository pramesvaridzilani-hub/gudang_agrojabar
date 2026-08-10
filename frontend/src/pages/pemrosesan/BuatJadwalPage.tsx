import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { jadwalProduksiApi, PreviewJadwalResult } from '../../api/jadwal-produksi.api';
import {
  ArrowLeft,
  CalendarDays,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  Save,
  RotateCcw,
  Wallet,
  ChevronRight,
} from 'lucide-react';

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
const YIELD_LOSS_MAP: Record<string, number> = {
  Wortel: 35,
  Jagung: 70,
  Buncis: 7,
};

const BuatJadwalPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const gudangId = (user?.managedWarehouses as any[])?.[0]?.id || '';
  const gudangNama = (user?.managedWarehouses as any[])?.[0]?.nama || 'Gudang';

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const state = location.state as any;
  const rencanaProduksi = state?.rencanaProduksi;

  const initPengajuanId = searchParams.get('pengajuanId') || '';
  const initPermintaanId = searchParams.get('permintaanId') || '';
  const initKomoditas = searchParams.get('komoditas') || '';
  const initVolume = searchParams.get('volume') || '';
  const searchKemasan = searchParams.get('kemasan');
  const searchKombinasiBesar = searchParams.get('kombinasiBesar');
  const searchBahanBaku = searchParams.get('bahanBaku');

  const initKemasan = (searchKemasan && searchKemasan !== '0') ? searchKemasan : (rencanaProduksi?.kemasan || '1');
  const initKemasanKustom = rencanaProduksi?.kemasanKustom || '5';
  
  // Ambil default kombinasiBesar dari URL (jika dikirim dari Demand Pool) atau dari rencanaProduksi sebelumnya
  const initKemasanKombinasiBesar = searchKombinasiBesar || rencanaProduksi?.kemasanKombinasiBesar || '0';
  
  const initEstimasiBahanBaku = searchBahanBaku ? Number(searchBahanBaku) : undefined;

  // ── Form State ──
  const [form, setForm] = useState({
    tenggat: state?.selectedDate ? state.selectedDate.split('T')[0] : '',
    kapasitasHarianKg: '1000',
    tarifPekerja: '1500',
    catatanJadwal: '',
    pengajuanId: initPengajuanId,
    permintaanPengadaanId: initPermintaanId,
  });

  type KomoditasItem = {
    id: string;
    nama: string;
    volumeKg: string;
    kemasan: string;
    kemasanKustom: string;
    kemasanKombinasiBesar: string;
    estimasiBahanBakuRp?: number;
    permintaanIds?: string[];
    pengajuanIds?: string[];
  };

  const selectedItems = state?.selectedItems as any[];

  const [items, setItems] = useState<KomoditasItem[]>(() => {
    const initPermintaanIds = searchParams.get('permintaanIds') ? searchParams.get('permintaanIds')?.split(',') : undefined;
    const initPengajuanIds = searchParams.get('pengajuanIds') ? searchParams.get('pengajuanIds')?.split(',') : undefined;

    if (selectedItems && selectedItems.length > 0) {
      return selectedItems.map((si, idx) => ({
        id: Date.now().toString() + idx,
        nama: si.nama || '',
        volumeKg: si.volumeKg || '',
        kemasan: si.kemasan || '1',
        kemasanKustom: '5',
        kemasanKombinasiBesar: si.kemasanKombinasiBesar || '0',
        estimasiBahanBakuRp: si.estimasiBahanBakuRp || undefined,
        permintaanIds: si.permintaanIds,
        pengajuanIds: si.pengajuanIds,
      }));
    }
    return [{
      id: Date.now().toString(),
      nama: initKomoditas,
      volumeKg: initVolume,
      kemasan: initKemasan,
      kemasanKustom: initKemasanKustom,
      kemasanKombinasiBesar: initKemasanKombinasiBesar,
      estimasiBahanBakuRp: initEstimasiBahanBaku,
      permintaanIds: initPermintaanIds || (initPermintaanId ? [initPermintaanId] : undefined),
      pengajuanIds: initPengajuanIds || (initPengajuanId ? [initPengajuanId] : undefined),
    } as any];
  });

  // ── Preview & UI State ──
  const [preview, setPreview] = useState<PreviewJadwalResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stokData, setStokData] = useState<any[]>([]);
  const [orderedDeficits, setOrderedDeficits] = useState<Record<string, string>>({});
  const [orderLoading, setOrderLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchStok = async () => {
      try {
        const res = await api.get('/produk/staf');
        setStokData(res.data?.data || []);
      } catch (err) {
        console.error('Gagal fetch stok:', err);
      }
    };
    fetchStok();
  }, []);

  // ── Auto-clamp kombinasi besar jika melebihi maxBesar ──
  useEffect(() => {
    let changed = false;
    const newItems = items.map(item => {
      if (item.kemasan === 'kombinasi') {
        const yieldLoss = YIELD_LOSS_MAP[item.nama] || 0;
        const rawVolume = parseFloat(item.volumeKg) || 0;
        const penyusutanKg = rawVolume * (yieldLoss / 100);
        const hasilJadiKg = Math.round(Math.max(0, rawVolume - penyusutanKg));
        const maxBesar = Math.floor(hasilJadiKg / 2.5);
        const currentBesar = parseInt(item.kemasanKombinasiBesar) || 0;
        
        if (currentBesar > maxBesar) {
          changed = true;
          return { ...item, kemasanKombinasiBesar: maxBesar.toString() };
        }
      }
      return item;
    });
    
    if (changed) {
      setItems(newItems);
    }
  }, [items]);


  // ── Packaging & Yield State ──
  const totalVolumeKg = items.reduce((sum, it) => sum + (parseFloat(it.volumeKg) || 0), 0);
  const namaKomoditasGabungan = items.map(it => it.nama).filter(Boolean).join(', ');

  const isPreviewReady =
    items.every(it => {
      const vol = parseFloat(it.volumeKg);
      return it.nama.trim() !== '' && vol > 0;
    }) &&
    items.length > 0 &&
    form.tenggat !== '';

  const isSaveReady =
    isPreviewReady &&
    items.every(it => {
      const vol = parseFloat(it.volumeKg);
      const stock = stokData.find(s => s.nama === it.nama)?.stok || 0;
      return vol <= stock || orderedDeficits[it.id];
    });

  // ── Auto-hitung preview saat form berubah ──
  const hitungPreview = useCallback(async () => {
    if (!isPreviewReady) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const result = await jadwalProduksiApi.hitungPreview({
        volumeTotalKg: totalVolumeKg,
        tenggat: new Date(form.tenggat).toISOString(),
        kapasitasHarianKg: parseFloat(form.kapasitasHarianKg) || 1000,
      });
      setPreview(result);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal menghitung jadwal');
      setItems([{
      id: Date.now().toString(),
      nama: '',
      volumeKg: '',
      kemasan: '1',
      kemasanKustom: '5',
      kemasanKombinasiBesar: '0'
    }]);
    setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [totalVolumeKg, form.tenggat, form.kapasitasHarianKg, isPreviewReady]);

  useEffect(() => {
    const timer = setTimeout(hitungPreview, 600);
    return () => clearTimeout(timer);
  }, [hitungPreview]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSaved(false);
  };

  const handleSimpan = async () => {
    if (!preview || !gudangId) {
      setSaveError('Lengkapi form dan pastikan preview sudah muncul');
      return;
    }
    setSaveLoading(true);
    setSaveError(null);
    try {
      const detailKomoditasWithTarif = items.map(it => ({
        ...it,
        tarifPekerja: form.tarifPekerja
      }));

      await jadwalProduksiApi.create({
        gudangId,
        komoditasNama: namaKomoditasGabungan,
        volumeTotalKg: totalVolumeKg,
        tenggat: new Date(form.tenggat).toISOString(),
        kapasitasHarianKg: parseFloat(form.kapasitasHarianKg) || 1000,
        pengajuanId: form.pengajuanId.trim() || undefined,
        permintaanPengadaanId: Object.values(orderedDeficits)[0] || form.permintaanPengadaanId.trim() || undefined,
        catatanJadwal: form.catatanJadwal.trim() || undefined,
        detailKomoditas: detailKomoditasWithTarif,
      });
      setSaved(true);
      setTimeout(() => navigate(`/kepala-gudang/pemrosesan/sortir`), 800);
    } catch (e: any) {
      setSaveError(e?.response?.data?.error || 'Gagal menyimpan jadwal');
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePesanKekurangan = async (item: KomoditasItem, deficitKg: number) => {
    setOrderLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await api.post('/permintaan-pengadaan', {
        gudangId,
        komoditasNama: item.nama,
        targetKg: deficitKg,
        tipePesanan: 'MANUAL',
        catatan: `Otomatis dibuat dari defisit Jadwal Produksi (Butuh ${item.volumeKg} kg, Stok ${stokData.find(s => s.nama === item.nama)?.stok || 0} kg)`
      });
      if (res.data?.data?.id) {
        setOrderedDeficits(prev => ({ ...prev, [item.id]: res.data.data.id }));
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal memesan kekurangan ke petani');
    } finally {
      setOrderLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleReset = () => {
    setForm({
      tenggat: '',
      kapasitasHarianKg: '1000',
      tarifPekerja: '1500',
      catatanJadwal: '',
      pengajuanId: '',
      permintaanPengadaanId: '',
    });
    setOrderedDeficits({});
    setOrderLoading({});
    setItems([{
      id: Date.now().toString(),
      nama: '',
      volumeKg: '',
      kemasan: '1',
      kemasanKustom: '5',
      kemasanKombinasiBesar: '0'
    }]);
    setPreview(null);
    setError(null);
    setSaveError(null);
  };

  // Min tanggal tenggat: besok
  const minTanggal = new Date();
  minTanggal.setDate(minTanggal.getDate() + 1);
  const minTanggalStr = minTanggal.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm transition-all"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={20} className="text-emerald-600" />
            Buat Jadwal Produksi
          </h1>
          <p className="text-xs text-gray-500">{gudangNama}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 max-w-6xl">
        {/* ════ KIRI: Form ════ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Detail Produksi</h2>

            {/* List Komoditas */}
            <div className="space-y-4 mb-4">
              {items.map((item, index) => {
                const yieldLoss = YIELD_LOSS_MAP[item.nama] || 0;
                const rawVolume = parseFloat(item.volumeKg) || 0;
                const stockAvailable = stokData.find(s => s.nama === item.nama)?.stok || 0;
                const isVolumeExcessive = rawVolume > stockAvailable;
                const penyusutanKg = rawVolume * (yieldLoss / 100);
                const hasilJadiKg = Math.round(Math.max(0, rawVolume - penyusutanKg));
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
                        {item.nama && (
                          <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                            Stok curah tersedia: {stokData.find(s => s.nama === item.nama)?.stok?.toLocaleString('id-ID') || 0} kg
                          </p>
                        )}
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
                        )}
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
                                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                    item.kemasan === opt
                                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                      : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                                  }`}
                                >
                                  {opt === 'kustom' ? 'Kustom' : opt === 'kombinasi' ? 'Kombinasi' : `${opt} kg`}
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
                                      className="w-full rounded-md border border-amber-200 px-2 py-1 text-sm focus:outline-none focus:border-amber-400"
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
{/* Tenggat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tanggal Produksi <span className="text-red-500">*</span>
              </label>
              <input
                id="tenggat"
                name="tenggat"
                type="date"
                min={minTanggalStr}
                value={form.tenggat}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </div>

            {/* Kapasitas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Kapasitas Harian (kg)
              </label>
              <input
                id="kapasitasHarianKg"
                name="kapasitasHarianKg"
                type="number"
                min="100"
                step="100"
                max="10000"
                value={form.kapasitasHarianKg}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
              />
              <p className="mt-1 text-xs text-gray-400">Default: 1.000 kg/hari (1 ton)</p>
            </div>

            {/* Tarif Pekerja */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Biaya Borongan per kg (Rp)
              </label>
              <input
                id="tarifPekerja"
                name="tarifPekerja"
                type="number"
                min="0"
                step="100"
                value={form.tarifPekerja}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
              />
              <p className="mt-1 text-xs text-gray-400">Default: Rp 1.500/kg</p>
            </div>

            {/* ID Pengajuan (opsional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ID Pengajuan Grosir <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <input
                id="pengajuanId"
                name="pengajuanId"
                type="text"
                value={form.pengajuanId}
                onChange={handleChange}
                placeholder="Link ke pesanan e-commerce..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
              <textarea
                id="catatanJadwal"
                name="catatanJadwal"
                rows={3}
                value={form.catatanJadwal}
                onChange={handleChange}
                placeholder="Catatan tambahan untuk jadwal ini..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 transition-all resize-none"
              />
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 p-4">
            <Lightbulb size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Jadwal dihitung <strong>otomatis</strong>: Tanggal mulai = tenggat − estimasi hari produksi.
              Biaya borongan pengupasan dihitung <strong>Rp {parseFloat(form.tarifPekerja || '0').toLocaleString('id-ID')}/kg</strong>.
            </p>
          </div>
        </div>

        {/* ════ KANAN: Preview ════ */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4">
              Preview Jadwal Otomatis
            </h2>

            {!isPreviewReady ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <CalendarDays size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Isi komoditas, volume, dan tenggat</p>
                <p className="text-xs mt-1">untuk melihat jadwal otomatis</p>
              </div>
            ) : previewLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Loader2 size={28} className="animate-spin mb-2 text-emerald-500" />
                <p className="text-sm">Menghitung jadwal...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-red-700 text-sm flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                {error}
              </div>
            ) : preview ? (
              <div className="space-y-4">
                {/* Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Mulai Produksi',
                      value: formatTanggal(preview.tanggalMulai),
                      icon: <Clock size={14} className="text-emerald-500" />,
                    },
                    {
                      label: 'Total Hari',
                      value: `${preview.estimasiHari} hari`,
                      icon: <CalendarDays size={14} className="text-blue-500" />,
                    },
                    {
                      label: 'Kapasitas/Hari',
                      value: `${(preview.kapasitasHarianKg / 1000).toFixed(1)} ton`,
                      icon: <Package size={14} className="text-purple-500" />,
                    },
                    {
                      label: 'Est. Biaya Borongan',
                      value: formatRupiah(totalVolumeKg * parseFloat(form.tarifPekerja || '0')),
                      icon: <Wallet size={14} className="text-amber-500" />,
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        {s.icon}
                        <span className="text-xs text-gray-500">{s.label}</span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Warning Overlap */}
                {preview.peringatanOverlap.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-2 text-amber-700 font-semibold text-sm">
                      <AlertTriangle size={15} />
                      Peringatan Kapasitas Bentrok
                    </div>
                    {preview.peringatanOverlap.map((ov, i) => (
                      <div key={i} className="text-xs text-amber-600 flex justify-between border-t border-amber-200 pt-2 mt-2">
                        <span>{formatTanggal(ov.tanggal)}</span>
                        <span className="font-medium">+{ov.kelebihan.toFixed(0)} kg melebihi kapasitas</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tabel Jadwal Harian */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rincian Per Hari</p>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold">Hari</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Tanggal</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Target (kg)</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Biaya Borongan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {preview.hariProduksi.map((h) => (
                          <tr key={h.hariKe} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2.5 font-semibold text-emerald-700">H-{h.hariKe}</td>
                            <td className="px-4 py-2.5 text-gray-600">{formatTanggal(h.tanggal)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">
                              {h.targetKg.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-2.5 text-right text-amber-600 font-medium">
                              {formatRupiah(h.targetKg * parseFloat(form.tarifPekerja || '0'))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-emerald-50 border-t border-emerald-100">
                        <tr>
                          <td colSpan={2} className="px-4 py-2.5 font-bold text-emerald-800">Total</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-800">
                            {totalVolumeKg.toLocaleString('id-ID')} kg
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-amber-700">
                            {formatRupiah(totalVolumeKg * parseFloat(form.tarifPekerja || '0'))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* HPP Note */}
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700">
                    Estimasi biaya borongan <strong>{formatRupiah(totalVolumeKg * parseFloat(form.tarifPekerja || '0'))}</strong> akan
                    masuk sebagai komponen biaya tenaga kerja dalam kalkulasi{' '}
                    <strong>HPP (Harga Pokok Produksi)</strong>.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* ── Action Buttons ── */}
          {saveError && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-red-700 text-sm flex gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-all"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={handleSimpan}
              disabled={!preview || saveLoading || saved || previewLoading}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                saved
                  ? 'bg-blue-500 text-white'
                  : !preview || saveLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle2 size={15} /> Tersimpan! Mengarahkan...
                </>
              ) : saveLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save size={15} /> Simpan Jadwal
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuatJadwalPage;
