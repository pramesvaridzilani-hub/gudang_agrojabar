/**
 * Permintaan Pengadaan — Gudang Frontend
 *
 * Alur di halaman ini:
 * 1. Admin lihat "Sinyal Permintaan Pasar" (tren dari seller afiliasi)
 * 2. Pilih komoditas dari sinyal → buat Permintaan Pengadaan dengan targetKg & harga
 * 3. Kirim ke Kepala Petani terafiliasi dengan 1 klik
 * 4. Pantau komitmen yang masuk dari petani
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Minus, Send, Plus, Package,
  CheckCircle2, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  Users, Wheat, RefreshCw, X, Check, Trophy, BarChart2, ShoppingBag
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useLocation } from 'react-router-dom';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api');

// ─── Types ───────────────────────────────────────────────────────────────────
interface DemandItem {
  komoditasNama: string;
  kodeKomoditasGlobal: string | null;
  masterProdukId: string | null;
  jumlahTerjualKg: number;
  prevJumlahTerjualKg: number;
  totalRevenue: number;
  jumlahTransaksi: number;
  trendPersen: number | null;
  trendArah: 'UP' | 'DOWN' | 'STABLE';
  jumlahSeller: number;
}

interface DemandSignalData {
  gudangId: string;
  period: { month: number; year: number; label: string };
  prevPeriod: { label: string };
  totalTokoAfiliasi: number;
  data: DemandItem[];
}


// ─── Helpers & Cache ───────────────────────────────────────────────────────────
let globalCachedHargaPetani: any[] | null = null;
let globalCachedProdukList: any[] | null = null;

const fmtKg = (n: number) => `${n.toLocaleString('id-ID')} kg`;
const fmtRp = (n: number) => n >= 1_000_000
  ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : `Rp ${n.toLocaleString('id-ID')}`;

// ─── Yield Loss Config (% susut dari komoditas) ───────────────────────────────
const YIELD_LOSS_MAP: Record<string, number> = {
  wortel:  35,
  jagung:  70,
  buncis:   7,
};

const getYieldLoss = (namaKomoditas: string): number => {
  const key = namaKomoditas.toLowerCase().trim();
  for (const [k, v] of Object.entries(YIELD_LOSS_MAP)) {
    if (key.includes(k)) return v;
  }
  return 0;
};

/** Hitung kg yang harus dipesan ke petani setelah memperhitungkan yield loss */
const kgKePetani = (kekuranganKg: number, yieldLossPct: number): number => {
  if (yieldLossPct >= 100) return Math.round(kekuranganKg);
  return Math.round(kekuranganKg / (1 - yieldLossPct / 100));
};

// ─── cekStokKemasan (mirror dari PengajuanDetailPage) ────────────────────────
interface CekKemasanLine {
  ukuranKg: number;
  diminta: number;
  tersediaKemasan: number;
  terpenuhiKemasan: number;
  defisitPack: number;
  defisitKg: number;
}

interface CekStokResult {
  hasRincian: boolean;
  lines: CekKemasanLine[];
  bulkKg: number;
  butuhDariBulkKg: number;
  kekuranganKg: number;
  orderKg: number;
  finishedFromBulkKg: number;
  cukup: boolean;
}

const cekStok = (produkGudang: any, kemasan: { ukuranKg: number; jumlahKemasan: number }[], yieldLossPct: number = 0): CekStokResult => {
  const bulkKg = Number(produkGudang?.stokBulk) || 0;
  const kemasanGudang: any[] = produkGudang?.kemasan || [];

  if (!kemasan || kemasan.length === 0) {
    return { hasRincian: false, lines: [], bulkKg, butuhDariBulkKg: 0, kekuranganKg: 0, orderKg: 0, finishedFromBulkKg: 0, cukup: true };
  }

  const lines: CekKemasanLine[] = kemasan.map((pkg) => {
    const diminta = Number(pkg.jumlahKemasan) || 0;
    const stok = kemasanGudang.find((k) => Number(k.ukuranKg) === Number(pkg.ukuranKg));
    const tersediaKemasan = Number(stok?.stokKemasan) || 0;
    const terpenuhiKemasan = Math.min(diminta, tersediaKemasan);
    const defisitPack = Math.max(0, diminta - tersediaKemasan);
    const defisitKg = Math.round(defisitPack * (Number(pkg.ukuranKg) || 0) * 10) / 10;
    return { ukuranKg: Number(pkg.ukuranKg), diminta, tersediaKemasan, terpenuhiKemasan, defisitPack, defisitKg };
  });

  const butuhDariBulkKg = Math.round(lines.reduce((s, l) => s + l.defisitKg, 0) * 10) / 10;
  const yieldRatio = Math.max(0.01, 1 - (yieldLossPct / 100));
  const finishedFromBulkKg = Math.round(bulkKg * yieldRatio * 10) / 10;
  const kekuranganFinishedKg = Math.round(Math.max(0, butuhDariBulkKg - finishedFromBulkKg) * 10) / 10;
  const orderKg = Math.round((kekuranganFinishedKg / yieldRatio) * 10) / 10;

  return { hasRincian: true, lines, bulkKg, butuhDariBulkKg, kekuranganKg: kekuranganFinishedKg, orderKg, finishedFromBulkKg, cukup: kekuranganFinishedKg <= 0 };
};

const deriveKemasan = (item: any) => {
  if (item.kemasanDetail && item.kemasanDetail.length > 0) {
    return item.kemasanDetail.map((k: any) => ({ ukuranKg: k.ukuranKg, jumlahKemasan: k.jumlahKemasan }));
  }
  if (item.ukuranKemasanKg && item.jumlahKemasan) {
    return [{ ukuranKg: item.ukuranKemasanKg, jumlahKemasan: item.jumlahKemasan }];
  }
  return [];
};

// ─── Form Buat Permintaan ─────────────────────────────────────────────────────
interface FormBuatPermintaanProps {
  item: DemandItem;
  gudangId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const FormBuatPermintaan: React.FC<FormBuatPermintaanProps> = ({ item, gudangId, onSuccess, onClose }) => {
  const token = useAuthStore(s => s.token);
  const [form, setForm] = useState({
    targetKg: Math.round(item.jumlahTerjualKg * 1.2).toLocaleString('id-ID'),
    hargaAcuanPerKg: '',
    deadlinePanen: '',
    catatan: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHarga = async () => {
      try {
        let hargaList = globalCachedHargaPetani;
        if (!hargaList) {
          const res = await axios.get(`${API}/harga-petani`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          hargaList = res.data || [];
          globalCachedHargaPetani = hargaList;
        }

        const match = hargaList?.find((hp: any) => 
          hp.kodeKomoditasGlobal === item.kodeKomoditasGlobal || hp.namaPetani === item.komoditasNama
        );
        if (match && match.hargaPetani) {
          setForm(f => ({ ...f, hargaAcuanPerKg: match.hargaPetani.toString() }));
        }
      } catch(err) {
        console.error('Gagal ambil harga petani', err);
      }
    };
    if (token) fetchHarga();
  }, [item, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API}/permintaan-pengadaan`, {
        gudangId,
        komoditasNama: item.komoditasNama,
        kodeKomoditasGlobal: item.kodeKomoditasGlobal,
        masterProdukId: item.masterProdukId,
        targetKg: parseFloat(form.targetKg.replace(/\./g, '')),
        hargaAcuanPerKg: form.hargaAcuanPerKg || undefined,
        deadlinePanen: form.deadlinePanen || undefined,
        catatan: form.catatan || undefined,
        jumlahTerjualKgBulanIni: item.jumlahTerjualKg,
        jumlahTerjualKgBulanLalu: item.prevJumlahTerjualKg,
        trendPersen: item.trendPersen,
        trendArah: item.trendArah,
        jumlahSellerMenjual: item.jumlahSeller,
        nomorOrder: `ORD-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        tipePesanan: 'SELLER',
      }, { headers: { Authorization: `Bearer ${token}` } });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal membuat permintaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-lg text-gray-800">Buat Permintaan Pengadaan</h3>
          <span className="text-xs text-gray-400 font-medium">Tgl Order: {new Date().toLocaleDateString('id-ID')}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-semibold text-emerald-700">{item.komoditasNama}</span>
          {' '}· Terjual {fmtKg(item.jumlahTerjualKg)} bulan ini
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Target Kebutuhan (kg) *</label>
            <input
              type="text"
              value={form.targetKg}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                if (!val) return setForm({ ...form, targetKg: '' });
                setForm({ ...form, targetKg: Number(val).toLocaleString('id-ID') });
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              required
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Saran: {fmtKg(Math.round(item.jumlahTerjualKg * 1.2))} (120% dari terjual bulan ini)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center justify-between">
              Harga Acuan per kg (Rp)
              {form.hargaAcuanPerKg && <span className="text-[9px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-100 rounded">Auto-sync Petani</span>}
            </label>
            <input
              type="number" min="0" step="100"
              value={form.hargaAcuanPerKg}
              readOnly
              placeholder="Terisi otomatis dari harga petani"
              className="w-full border border-gray-200 bg-gray-50 text-gray-500 rounded-xl px-3 py-2.5 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Target Tanggal Kedatangan</label>
            <input
              type="date"
              value={form.deadlinePanen}
              onChange={e => setForm({ ...form, deadlinePanen: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan untuk Kepala Petani</label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={e => setForm({ ...form, catatan: e.target.value })}
              placeholder="Info tambahan, spesifikasi kualitas, dll..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">
              Batal
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Membuat...' : 'Buat (DRAFT)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Form Manual (dari Stok Gudang) ──────────────────────────────────────────
interface FormManualProps {
  gudangId: string;
  token: string | null;
  initialKomoditas?: string;
  prefilledItems?: Array<{
    komoditasNama: string;
    targetProduksiKg: string;
    kemasan: string;
    kemasanKombinasiBesar: string;
    kemasanKombinasiKecil: string;
  }>;
  onSuccess: () => void;
}

const FormManualFromStok: React.FC<FormManualProps> = ({ gudangId, token, initialKomoditas, prefilledItems, onSuccess }) => {
  const [produkList, setProdukList] = useState<any[]>([]);
  const [loadingProduk, setLoadingProduk] = useState(true);
  const [hargaPetaniList, setHargaPetaniList] = useState<any[]>([]);

  const queryParams = new URLSearchParams(window.location.search);
  const qKomoditas = queryParams.get('komoditas') || '';
  const qTarget = queryParams.get('target') || '';
  const qKemasan = queryParams.get('kemasan') || '1';
  const qPackBesar = queryParams.get('packBesar') || '0';
  const qPackKecil = queryParams.get('packKecil') || '0';

  const [items, setItems] = useState<any[]>(() => {
    if (prefilledItems && prefilledItems.length > 0) {
      return prefilledItems.map((pi: any, idx: number) => ({
        id: Date.now().toString() + idx,
        komoditasNama: pi.komoditasNama || '',
        targetProduksiKg: pi.targetProduksiKg || '',
        orderVolumeKg: pi.targetProduksiKg
          ? kgKePetani(parseFloat(pi.targetProduksiKg), getYieldLoss(pi.komoditasNama || '')).toString()
          : '',
        hargaAcuanPerKg: '',
        deadlinePanen: '',
        catatan: pi.catatan || '',
        kemasan: pi.kemasan || '1',
        kemasanKustom: '5',
        kemasanKombinasiBesar: pi.kemasanKombinasiBesar || '0',
        kemasanKombinasiKecil: pi.kemasanKombinasiKecil || '0',
      }));
    }

    return [{
      id: Date.now().toString(),
      komoditasNama: qKomoditas || initialKomoditas || '',
      targetProduksiKg: qTarget || '',
      orderVolumeKg: qTarget ? kgKePetani(parseFloat(qTarget), getYieldLoss(qKomoditas || initialKomoditas || '')).toString() : '',
      hargaAcuanPerKg: '',
      deadlinePanen: '',
      catatan: '',
      kemasan: qKemasan || '1',
      kemasanKustom: '5',
      kemasanKombinasiBesar: qPackBesar || '0',
      kemasanKombinasiKecil: qPackKecil || '0',
    }];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [globalDeadline, setGlobalDeadline] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Sync items bila prefilledItems atau URL query params berubah
  useEffect(() => {
    if (prefilledItems && prefilledItems.length > 0) {
      setItems(
        prefilledItems.map((pi: any, idx: number) => ({
          id: Date.now().toString() + idx,
          komoditasNama: pi.komoditasNama || '',
          targetProduksiKg: pi.targetProduksiKg || '',
          orderVolumeKg: pi.targetProduksiKg
            ? kgKePetani(parseFloat(pi.targetProduksiKg), getYieldLoss(pi.komoditasNama || '')).toString()
            : '',
          hargaAcuanPerKg: '',
          deadlinePanen: '',
          catatan: pi.catatan || '',
          kemasan: pi.kemasan || '1',
          kemasanKustom: '5',
          kemasanKombinasiBesar: pi.kemasanKombinasiBesar || '0',
          kemasanKombinasiKecil: pi.kemasanKombinasiKecil || '0',
        }))
      );
    } else if (qKomoditas || qTarget) {
      setItems([
        {
          id: Date.now().toString(),
          komoditasNama: qKomoditas || initialKomoditas || '',
          targetProduksiKg: qTarget || '',
          orderVolumeKg: qTarget ? kgKePetani(parseFloat(qTarget), getYieldLoss(qKomoditas || initialKomoditas || '')).toString() : '',
          hargaAcuanPerKg: '',
          deadlinePanen: '',
          catatan: '',
          kemasan: qKemasan || '1',
          kemasanKustom: '5',
          kemasanKombinasiBesar: qPackBesar || '0',
          kemasanKombinasiKecil: qPackKecil || '0',
        }
      ]);
    }
  }, [prefilledItems, qKomoditas, qTarget, initialKomoditas]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (globalCachedProdukList && globalCachedHargaPetani) {
          setProdukList(globalCachedProdukList);
          setHargaPetaniList(globalCachedHargaPetani);
          setLoadingProduk(false);
          return;
        }

        const [resProduk, resHarga] = await Promise.all([
          axios.get(`${API}/produk/staf`, {
            params: { gudangId },
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API}/harga-petani`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        
        globalCachedProdukList = resProduk.data?.data || resProduk.data || [];
        globalCachedHargaPetani = resHarga.data || [];
        
        setProdukList(globalCachedProdukList || []);
        setHargaPetaniList(globalCachedHargaPetani || []);
      } catch (err) {
        console.error('Gagal ambil data:', err);
      } finally {
        setLoadingProduk(false);
      }
    };
    if (gudangId && token) fetchData();
  }, [gudangId, token]);

  useEffect(() => {
    if (produkList.length === 0 || hargaPetaniList.length === 0) return;

    // Auto-fill harga per item berdasarkan komoditas & hitung orderVolumeKg
    setItems(prev => {
      const newItems = [...prev];
      let changed = false;
      newItems.forEach((item, idx) => {
        const nama = item.komoditasNama;
        if (!nama) return;

        // Calculate order volume if not set
        if (item.targetProduksiKg && !item.orderVolumeKg) {
          const yl = getYieldLoss(nama);
          newItems[idx] = { ...newItems[idx], orderVolumeKg: kgKePetani(parseFloat(item.targetProduksiKg), yl).toString() };
          changed = true;
        }

        if (item.hargaAcuanPerKg) return; // skip jika harga sudah ada

        const produk = produkList.find(p => p.nama.toLowerCase().includes(nama.toLowerCase()));
        let match = null;
        if (produk) {
          match = hargaPetaniList.find(hp =>
            hp.masterKomoditasId === produk.masterKomoditasId ||
            hp.kodeKomoditasGlobal === (produk.masterKomoditas?.kodeKomoditasGlobal || produk.kodeKomoditasGlobal) ||
            hp.namaPetani === produk.nama
          );
        }
        if (!match) {
          match = hargaPetaniList.find(hp => 
            (hp.namaMaster && hp.namaMaster.toLowerCase().includes(nama.toLowerCase())) || 
            (hp.namaPetani && hp.namaPetani.toLowerCase().includes(nama.toLowerCase()))
          );
        }
        
        if (match && match.hargaPetani) {
          newItems[idx] = { ...newItems[idx], hargaAcuanPerKg: match.hargaPetani.toString() };
          changed = true;
        }
      });
      return changed ? newItems : prev;
    });
  }, [initialKomoditas, qKomoditas, prefilledItems, produkList, hargaPetaniList]);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    // Auto-fill harga & auto-calculate order volume when komoditas changes
    if (field === 'komoditasNama') {
      const nama = value;
      const produk = produkList.find(p => p.nama.toLowerCase().includes(nama.toLowerCase()));
      let match = null;
      if (produk) {
        match = hargaPetaniList.find(hp => 
          hp.masterKomoditasId === produk.masterKomoditasId || 
          hp.kodeKomoditasGlobal === (produk.masterKomoditas?.kodeKomoditasGlobal || produk.kodeKomoditasGlobal) || 
          hp.namaPetani === produk.nama
        );
      }
      if (!match) {
        match = hargaPetaniList.find(hp => 
          (hp.namaMaster && hp.namaMaster.toLowerCase().includes(nama.toLowerCase())) || 
          (hp.namaPetani && hp.namaPetani.toLowerCase().includes(nama.toLowerCase()))
        );
      }
      item.hargaAcuanPerKg = (match && match.hargaPetani) ? match.hargaPetani.toString() : '';
        
      // Recalculate order volume if targetProduksiKg exists
      if (item.targetProduksiKg && nama) {
        const yl = getYieldLoss(nama);
        item.orderVolumeKg = kgKePetani(parseFloat(item.targetProduksiKg), yl).toString();
      }
    }

    // Auto-calculate order volume when targetProduksiKg changes
    if (field === 'targetProduksiKg') {
      if (item.komoditasNama && value) {
        const yl = getYieldLoss(item.komoditasNama);
        item.orderVolumeKg = kgKePetani(parseFloat(value), yl).toString();
      } else {
        item.orderVolumeKg = value;
      }
    }

    if (field === 'kemasanKombinasiBesar' || field === 'kemasanKombinasiKecil') {
      const besar = field === 'kemasanKombinasiBesar' ? parseInt(value) || 0 : parseInt(item.kemasanKombinasiBesar) || 0;
      const kecil = field === 'kemasanKombinasiKecil' ? parseInt(value) || 0 : parseInt(item.kemasanKombinasiKecil) || 0;
      const targetKg = (besar * 2.5) + (kecil * 1);
      item.targetProduksiKg = targetKg.toString();
      if (item.komoditasNama && targetKg > 0) {
        const yl = getYieldLoss(item.komoditasNama);
        item.orderVolumeKg = kgKePetani(targetKg, yl).toString();
      }
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(it => it.id !== id));
  };

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      komoditasNama: '',
      targetProduksiKg: '',
      orderVolumeKg: '',
      hargaAcuanPerKg: '',
      deadlinePanen: '',
      catatan: '',
      kemasan: '1',
      kemasanKustom: '5',
      kemasanKombinasiBesar: '0',
      kemasanKombinasiKecil: '0',
    }]);
  };

  const processSubmit = async () => {
    setError('');
    setSuccess('');
    setShowConfirm(false);
    
    // Validasi
    const invalidItem = items.find(it => !it.komoditasNama || !it.targetProduksiKg);
    if (invalidItem) {
      setError('Mohon lengkapi komoditas dan target produksi untuk semua baris.');
      return;
    }

    setLoading(true);
    let successCount = 0;

    try {
      for (const item of items) {
        const produk = produkList.find(p => p.nama.toLowerCase().includes(item.komoditasNama.toLowerCase()));

        // 1. Buat permintaan pengadaan (DRAFT)
        const createRes = await axios.post(`${API}/permintaan-pengadaan`, {
          gudangId,
          komoditasNama: item.komoditasNama,
          kodeKomoditasGlobal: produk?.kodeKomoditasGlobal || null,
          targetKg: parseFloat(item.orderVolumeKg) || parseFloat(item.targetProduksiKg),
          hargaAcuanPerKg: item.hargaAcuanPerKg ? parseFloat(item.hargaAcuanPerKg) : undefined,
          deadlinePanen: globalDeadline || undefined,
          catatan: item.catatan || `Target Produksi: ${item.targetProduksiKg}kg`,
          jumlahTerjualKgBulanIni: 0,
          jumlahTerjualKgBulanLalu: 0,
          trendPersen: null,
          trendArah: 'STABLE',
          jumlahSellerMenjual: 0,
          nomorOrder: `ORD-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
          tipePesanan: 'MANUAL',
          rencanaProduksi: {
            kemasan: item.kemasan,
            kemasanKustom: item.kemasanKustom,
            kemasanKombinasiBesar: item.kemasanKombinasiBesar,
            kemasanKombinasiKecil: item.kemasanKombinasiKecil,
            targetProduksiKg: item.targetProduksiKg,
          },
        }, { headers: { Authorization: `Bearer ${token}` } });

        const ppId = createRes.data?.data?.id;
        if (!ppId) throw new Error(`Gagal membuat permintaan pengadaan untuk ${item.komoditasNama}`);

        // 2. Langsung kirim ke PETANI
        await axios.post(`${API}/permintaan-pengadaan/${ppId}/kirim`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });

        successCount++;
      }

      setSuccess(`Berhasil mengirim ${successCount} permintaan komoditas ke kepala petani!`);
      setItems([{
        id: Date.now().toString(),
        komoditasNama: '',
        targetProduksiKg: '',
        orderVolumeKg: '',
        hargaAcuanPerKg: '',
        deadlinePanen: '',
        catatan: '',
        kemasan: '1',
        kemasanKustom: '5',
        kemasanKombinasiBesar: '0',
      }]);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Gagal membuat/mengirim beberapa permintaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">📦 Ajukan Langsung dari Stok Gudang (Multi-Komoditas)</p>
        <p className="text-xs text-blue-600">
          Pilih produk dari katalog gudang Anda, masukkan target hasil produksi, sistem akan otomatis menghitung volume pesanan (kg) ke petani berdasarkan estimasi penyusutan (yield loss).
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={(e) => {
        e.preventDefault();
        
        // Validasi
        const invalidItem = items.find(it => !it.komoditasNama || !it.targetProduksiKg || !it.hargaAcuanPerKg);
        if (invalidItem) {
          setError('Mohon lengkapi komoditas, target produksi, dan pastikan harga muncul untuk semua baris.');
          return;
        }

        setShowConfirm(true);
      }} className="space-y-4">
        {/* Global Deadline */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target Tanggal Kedatangan (Untuk Semua Komoditas)</label>
          <input
            type="date"
            value={globalDeadline}
            onChange={e => setGlobalDeadline(e.target.value)}
            className="w-full md:w-1/2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        {items.map((item, index) => {
          const yl = item.komoditasNama ? getYieldLoss(item.komoditasNama) : 0;

          return (
            <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700 text-sm">Komoditas #{index + 1}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-medium">Tanggal Order: {new Date().toLocaleDateString('id-ID')}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-400 hover:text-red-600 text-xs font-semibold px-2 py-1 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Pilih Produk */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pilih Komoditas *</label>
                  {initialKomoditas && index === 0 ? (
                    <input
                      type="text"
                      value={item.komoditasNama}
                      readOnly
                      className="w-full border border-gray-200 bg-gray-50 text-gray-500 rounded-xl px-3 py-2.5 text-sm cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={item.komoditasNama}
                      onChange={e => updateItem(index, 'komoditasNama', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      required
                    >
                      <option value="">-- Pilih Komoditas --</option>
                      {item.komoditasNama && !produkList.some(p => p.nama === item.komoditasNama) && !hargaPetaniList.some(hp => hp.namaMaster === item.komoditasNama || hp.namaPetani === item.komoditasNama) && !['Wortel', 'Jagung', 'Buncis'].includes(item.komoditasNama) && (
                        <option value={item.komoditasNama}>{item.komoditasNama}</option>
                      )}
                      {Array.from(new Set([
                        ...produkList.map(p => p.nama),
                        ...hargaPetaniList.map(hp => hp.namaMaster || hp.namaPetani),
                        'Wortel', 'Jagung', 'Buncis'
                      ])).filter(Boolean).map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Harga & Stok Info */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
                    Harga Acuan (Rp/kg)
                    {item.hargaAcuanPerKg && <span className="text-[9px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-100 rounded">Auto-sync Petani</span>}
                  </label>
                  <input
                    type="number" min="0" step="100"
                    value={item.hargaAcuanPerKg}
                    readOnly
                    placeholder="Terisi otomatis"
                    className="w-full border border-gray-200 bg-gray-50 text-gray-500 rounded-xl px-3 py-2.5 text-sm cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Kalkulator Volume */}
              {item.komoditasNama && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-amber-800 mb-1.5">Target Hasil Produksi (kg) *</label>
                    <input
                      type="number" min="1" step="0.1"
                      value={item.targetProduksiKg}
                      onChange={e => updateItem(index, 'targetProduksiKg', e.target.value)}
                      placeholder="Contoh: 325"
                      className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                      required
                    />
                    <p className="text-[10px] text-amber-600 mt-1">Hasil bersih yang didapat.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-800 mb-1.5 flex justify-between items-center">
                      <span>Order ke Petani (kg)</span>
                      <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-emerald-700 border border-emerald-200">
                        Penyusutan {yl}%
                      </span>
                    </label>
                    <input
                      type="number"
                      value={item.orderVolumeKg}
                      readOnly
                      className="w-full border border-emerald-300 bg-emerald-100 text-emerald-900 font-bold rounded-xl px-3 py-2 text-sm cursor-not-allowed"
                    />
                    <p className="text-[10px] text-emerald-700 mt-1">Otomatis (Target / Yield)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1.5">Estimasi Biaya (Rp)</label>
                    <input
                      type="text"
                      value={item.hargaAcuanPerKg && item.orderVolumeKg ? `Rp ${(parseFloat(item.hargaAcuanPerKg) * parseFloat(item.orderVolumeKg)).toLocaleString('id-ID')}` : '-'}
                      readOnly
                      className="w-full border border-blue-300 bg-blue-100 text-blue-900 font-bold rounded-xl px-3 py-2 text-sm cursor-not-allowed"
                    />
                    <p className="text-[10px] text-blue-700 mt-1">Harga Acuan x Order Petani</p>
                  </div>
                </div>
              )}

              {/* Perencanaan Kemasan */}
              {item.komoditasNama && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-4">
                  <label className="block text-xs font-bold text-emerald-800 mb-3 flex items-center gap-2">
                    <Package size={14} />
                    Rencana Kemasan (Perencanaan Produksi)
                  </label>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <select
                        value={item.kemasan}
                        onChange={(e) => updateItem(index, 'kemasan', e.target.value)}
                        className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 bg-white"
                      >
                        <option value="1">Kemasan 1 kg</option>
                        <option value="2.5">Kemasan 2.5 kg</option>
                        <option value="5">Kemasan 5 kg</option>
                        <option value="10">Kemasan 10 kg</option>
                        <option value="kustom">Kemasan Kustom (Lainnya)</option>
                        <option value="kombinasi">Kombinasi (2.5 kg & 1 kg)</option>
                      </select>

                      {item.kemasan === 'kustom' && (
                        <div className="flex items-center gap-2 mt-3">
                          <input
                            type="number" min="0.1" step="0.1"
                            value={item.kemasanKustom}
                            onChange={(e) => updateItem(index, 'kemasanKustom', e.target.value)}
                            className="flex-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-400"
                            placeholder="Berat per kemasan (kg)"
                          />
                          <span className="text-xs font-semibold text-emerald-700">kg/pack</span>
                        </div>
                      )}

                      {item.kemasan === 'kombinasi' && (
                        <div className="mt-3 bg-white p-3 rounded-lg border border-emerald-100">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-semibold text-emerald-700">Kemasan 2.5 kg:</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number" min="0"
                                  value={item.kemasanKombinasiBesar || ''}
                                  onChange={(e) => updateItem(index, 'kemasanKombinasiBesar', e.target.value)}
                                  className="w-20 rounded border border-emerald-200 px-2 py-1 focus:outline-none focus:border-emerald-400 text-right"
                                />
                                <span className="text-xs text-gray-500">pack</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t border-emerald-50 pt-2">
                              <span className="font-semibold text-emerald-700">Kemasan 1 kg:</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number" min="0"
                                  value={item.kemasanKombinasiKecil || ''}
                                  onChange={(e) => updateItem(index, 'kemasanKombinasiKecil', e.target.value)}
                                  className="w-20 rounded border border-emerald-200 px-2 py-1 focus:outline-none focus:border-emerald-400 text-right"
                                />
                                <span className="text-xs text-gray-500">pack</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-emerald-600 italic mt-1 text-right">
                              Target Produksi di-update otomatis!
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {item.kemasan !== 'kombinasi' && (
                      <div className="w-1/3 bg-emerald-600 rounded-lg p-3 text-center shadow-sm flex flex-col justify-center">
                        <p className="text-[10px] text-emerald-100 mb-1">Rencana Jumlah Pack</p>
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" min="0"
                            value={(() => {
                              const tg = parseFloat(item.targetProduksiKg) || 0;
                              const k = item.kemasan === 'kustom' ? (parseFloat(item.kemasanKustom) || 1) : parseFloat(item.kemasan);
                              return Math.floor(tg / k) || '';
                            })()}
                            onChange={(e) => {
                              const pack = parseInt(e.target.value) || 0;
                              const k = item.kemasan === 'kustom' ? (parseFloat(item.kemasanKustom) || 1) : parseFloat(item.kemasan);
                              updateItem(index, 'targetProduksiKg', (pack * k).toString());
                            }}
                            className="w-16 bg-emerald-700 text-white font-bold text-sm px-1 py-0.5 rounded border border-emerald-500 text-center focus:outline-none focus:ring-1 focus:ring-white"
                          />
                          <span className="text-xs font-semibold text-emerald-100">pack</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Catatan */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catatan</label>
                  <textarea
                    rows={1}
                    value={item.catatan}
                    onChange={e => updateItem(index, 'catatan', e.target.value)}
                    placeholder="Info tambahan untuk petani..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                  />
                </div>
              </div>

            </div>
          );
        })}

        <button
          type="button"
          onClick={addItem}
          className="w-full py-3 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Tambah Komoditas Lain
        </button>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || loadingProduk || items.length === 0 || items.some(it => !it.komoditasNama || !it.targetProduksiKg || !it.hargaAcuanPerKg)}
          className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all mt-6"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? 'Mengirim ke petani...' : 'Kirim Semua ke Kepala Petani'}
        </button>
      </form>

      {/* Modal Konfirmasi */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Check size={24} className="text-emerald-500" /> Konfirmasi Order ke Petani
              </h3>
              <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const harga = parseFloat(item.hargaAcuanPerKg) || 0;
                  const vol = parseFloat(item.orderVolumeKg) || 0;
                  const total = harga * vol;
                  return (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-gray-800">{item.komoditasNama}</h4>
                        <p className="text-sm text-gray-500 mt-1">Kuantitas: <span className="font-semibold text-emerald-700">{vol.toLocaleString('id-ID')} kg</span></p>
                      </div>
                      <div className="text-right bg-blue-50 p-3 rounded-lg border border-blue-100 min-w-[200px]">
                        <p className="text-[10px] text-blue-600 font-bold mb-1 uppercase tracking-wider">Total Harga</p>
                        <p className="text-sm font-black text-blue-900">
                          {harga && vol ? `Rp ${total.toLocaleString('id-ID')}` : '-'}
                        </p>
                        <p className="text-[10px] text-blue-500 mt-1">Rp {harga.toLocaleString('id-ID')} / kg</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-6">
                <span className="text-gray-500 font-bold">GRAND TOTAL ESTIMASI</span>
                <span className="text-2xl font-black text-emerald-600">
                  Rp {items.reduce((acc, item) => {
                    const h = parseFloat(item.hargaAcuanPerKg) || 0;
                    const v = parseFloat(item.orderVolumeKg) || 0;
                    return acc + (h * v);
                  }, 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={processSubmit}
                  className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  <Send size={18} /> Ya, Kirim Sekarang!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Dari Pesanan Seller (DENGAN kalkulator yield loss & stok defisit) ──
interface TabDariPesananProps {
  gudangId: string;
  token: string | null;
  onRequestCreated: () => void;
}

const TabDariPesanan: React.FC<TabDariPesananProps> = ({ gudangId, token, onRequestCreated }) => {
  const [pengajuanList, setPengajuanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [itemYieldLoss, setItemYieldLoss] = useState<Record<string, number>>({});

  const fetchPengajuan = async () => {
    try {
      const res = await axios.get(`${API}/pengajuan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = (res.data?.data || []).filter(
        (p: any) => p.status === 'DIAJUKAN' || p.status === 'DIPROSES'
      );
      setPengajuanList(list);
    } catch (err) {
      console.error('Gagal ambil pengajuan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPengajuan();
  }, [token]);

  // Flatten items, attach stok check — only show items with shortage
  const flatItems = pengajuanList.flatMap((req) =>
    (req.items || []).flatMap((item: any) => {
      const kemasan = deriveKemasan(item);
      const nama = item.produkGudang?.nama || item.produk?.nama || item.produkNama || '';
      const key = `${req.id}-${item.id}`;
      const yl = itemYieldLoss[key] ?? getYieldLoss(nama);
      const cek = cekStok(item.produkGudang, kemasan, yl);

      const isCampuran = item.produkGudang?.komposisi && item.produkGudang.komposisi.length > 0;

      if (!cek.cukup && isCampuran) {
        return item.produkGudang.komposisi.map((komp: any, idx: number) => {
          const proporsi = komp.jumlahKg || 0;
          const komoditasBahan = komp.masterKomoditas?.nama || 'Komponen';
          const ylKomp = getYieldLoss(komoditasBahan);
          const yieldRatioKomp = Math.max(0.01, 1 - (ylKomp / 100));
          
          const deficiencyKompFinished = cek.kekuranganKg * proporsi;
          const orderKg = Math.round((deficiencyKompFinished / yieldRatioKomp) * 10) / 10;
          
          return {
            ...item,
            id: `${item.id}-bom-${idx}`, // unique ID for React keys
            pengajuanId: req.id,
            sellerNama: req.toko?.nama || req.tokoNama || 'Seller',
            gudangId: req.gudangId || gudangId,
            pengajuanStatus: req.status,
            pengajuanCreatedAt: req.createdAt,
            komoditasTarget: komoditasBahan,
            kodeGlobalTarget: komp.masterKomoditas?.kodeKomoditasGlobal,
            _cek: {
              ...cek,
              kekuranganKg: deficiencyKompFinished,
              orderKg: orderKg,
            },
            _isBahanBOM: true,
            _namaProdukAsli: nama
          };
        });
      }

      return [{
        ...item,
        pengajuanId: req.id,
        sellerNama: req.toko?.nama || req.tokoNama || 'Seller',
        gudangId: req.gudangId || gudangId,
        pengajuanStatus: req.status,
        pengajuanCreatedAt: req.createdAt,
        komoditasTarget: nama,
        kodeGlobalTarget: item.produkGudang?.masterKomoditas?.kodeKomoditasGlobal || item.produkGudang?.kodeKomoditasGlobal,
        _cek: cek,
      }];
    })
  ).filter((item) => !item._cek.cukup);

  // Initialize yield-loss defaults when list loads
  useEffect(() => {
    const defaults: Record<string, number> = {};
    flatItems.forEach((item) => {
      const key = `${item.pengajuanId}-${item.id}`;
      if (!(key in defaults)) {
        const nama = item.produkGudang?.nama || item.produk?.nama || item.produkNama || '';
        defaults[key] = getYieldLoss(nama);
      }
    });
    setItemYieldLoss((prev) => ({ ...defaults, ...prev }));
  }, [pengajuanList]);

  const handleBuatPermintaan = async (item: any) => {
    const key = `${item.pengajuanId}-${item.id}`;
    const yl = itemYieldLoss[key] ?? 0;
    const kekuranganKg = item._cek.kekuranganKg;
    const orderKg = item._cek.orderKg;
    const komoditasNama = item.komoditasTarget;
    const hargaPetani = item._isBahanBOM ? undefined : (Number(item.produkGudang?.hargaGudang) || undefined);

    setActionLoading(key);
    setError('');
    setSuccess('');
    try {
      const createRes = await axios.post(`${API}/permintaan-pengadaan`, {
        gudangId,
        komoditasNama,
        kodeKomoditasGlobal: item.kodeGlobalTarget || null,
        targetKg: orderKg,
        hargaAcuanPerKg: hargaPetani,
        catatan: item._isBahanBOM 
          ? `[BOM: ${item._namaProdukAsli}] Memenuhi pesanan ${item.sellerNama} — kekurangan bahan ${kekuranganKg} kg, order ke petani ${orderKg} kg · Pengajuan #${item.pengajuanId?.substring(0, 8)}`
          : `Memenuhi pesanan ${item.sellerNama} — kekurangan ${kekuranganKg} kg, order ke petani ${orderKg} kg (yield loss ${yl}%) · Pengajuan #${item.pengajuanId?.substring(0, 8)}`,
        jumlahTerjualKgBulanIni: 0,
        jumlahTerjualKgBulanLalu: 0,
        trendArah: 'STABLE',
        jumlahSellerMenjual: 1,
        nomorOrder: `ORD-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        tipePesanan: 'SELLER',
        sumberOrderId: item.pengajuanId || null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      const ppId = createRes.data?.data?.id;
      if (!ppId) throw new Error('Gagal membuat permintaan.');

      await axios.post(`${API}/permintaan-pengadaan/${ppId}/kirim`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess(`✅ Permintaan ${komoditasNama} ${orderKg} kg berhasil dikirim ke kepala petani!`);
      fetchPengajuan();
      onRequestCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Gagal membuat permintaan');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-2xl p-4">
        <p className="text-sm font-bold text-red-800 mb-1">🔴 Pengajuan Aktif — Stok Tidak Mencukupi</p>
        <p className="text-xs text-red-700/80 mb-2.5">
          Hanya menampilkan item dari pengajuan seller yang stoknya kurang. Kalkulator yield loss otomatis
          menghitung jumlah order ke petani setelah penyusutan.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(YIELD_LOSS_MAP).map(([k, v]) => (
            <span key={k} className="px-2.5 py-1 bg-white border border-red-200 rounded-lg text-[11px] font-semibold text-red-700">
              {k.charAt(0).toUpperCase() + k.slice(1)}: {v}% susut
            </span>
          ))}
          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-500">
            Lainnya: 0% (bisa diubah)
          </span>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {flatItems.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-300 mb-3" />
          <p className="text-gray-500 text-sm font-semibold">Semua stok mencukupi!</p>
          <p className="text-xs text-gray-400 mt-1">Tidak ada kekurangan stok dari pengajuan aktif saat ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-full">
              {flatItems.length} item kekurangan
            </span>
            <span className="text-xs text-slate-500">dari {pengajuanList.length} pengajuan aktif</span>
          </div>

          {flatItems.map((item) => {
            const key = `${item.pengajuanId}-${item.id}`;
            const nama = item.produkGudang?.nama || item.produk?.nama || item.produkNama || 'Produk';
            const kekuranganKg = item._cek.kekuranganKg;
            const orderKg = item._cek.orderKg;
            const yl = itemYieldLoss[key] ?? getYieldLoss(nama);
            const hargaPetani = Number(item.produkGudang?.hargaGudang) || 0;
            const totalBiaya = orderKg * hargaPetani;
            const isLoading = actionLoading === key;

            return (
              <div key={key} className="bg-white border-2 border-red-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 bg-red-50/60">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-800">{nama}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Users size={10} /> {item.sellerNama}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.pengajuanStatus === 'DIAJUKAN' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.pengajuanStatus === 'DIAJUKAN' ? 'Diajukan' : 'Diproses'}
                      </span>
                      <span className="text-[10px] text-slate-400">#{item.pengajuanId?.substring(0, 8)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black text-red-600">{kekuranganKg.toLocaleString('id-ID')} kg</p>
                    <p className="text-[10px] text-red-400 font-semibold uppercase">Kurang</p>
                  </div>
                </div>

                {/* Stok detail chips */}
                <div className="px-5 py-3 border-b border-red-100 bg-red-50/30 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600">
                    Diminta seller: <strong>{item.jumlahPermintaan || item.jumlahKg || 0} kg</strong>
                  </span>
                  {item._cek.butuhDariBulkKg > 0 && (
                    <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                      Perlu kemas: <strong>{item._cek.butuhDariBulkKg} kg</strong> (bruto)
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600" title={`Stok curah ${item._cek.bulkKg} kg menghasilkan ${item._cek.finishedFromBulkKg} kg setelah penyusutan`}>
                    Kapasitas curah: <strong>{item._cek.finishedFromBulkKg} kg</strong> (dari {item._cek.bulkKg}kg mentah)
                  </span>
                  <span className="px-2.5 py-1 bg-red-100 border border-red-300 rounded-lg text-[11px] text-red-700 font-bold">
                    ❌ Kurang: {kekuranganKg} kg (bersih)
                  </span>
                </div>

                {/* Kalkulator Yield Loss */}
                <div className="px-5 py-4">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-amber-800">🌾 Kalkulator Yield Loss & Order ke Petani</p>

                    {/* Yield loss input + hasil */}
                    <div className="flex items-end gap-4 flex-wrap">
                      <div className="min-w-[140px]">
                        <label className="block text-[10px] font-semibold text-amber-700 mb-1">
                          Penyusutan / Yield Loss (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={99}
                            step={0.5}
                            value={yl}
                            onChange={(e) =>
                              setItemYieldLoss((prev) => ({
                                ...prev,
                                [key]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-sm font-bold text-amber-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 pr-8"
                          />
                          <span className="absolute right-2.5 top-2.5 text-xs text-amber-500 font-bold">%</span>
                        </div>
                        {getYieldLoss(nama) > 0 && (
                          <p className="text-[10px] text-amber-600 mt-0.5">Default {nama}: {getYieldLoss(nama)}%</p>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="text-amber-400 text-xl pb-2">→</div>

                      {/* Result cards */}
                      <div className="flex gap-2 flex-wrap flex-1">
                        <div className="bg-white rounded-lg px-3 py-2.5 border border-amber-100 text-center min-w-[100px]">
                          <p className="text-[10px] text-slate-400">Kurang (Barang Jadi)</p>
                          <p className="text-base font-black text-red-600">{kekuranganKg} kg</p>
                        </div>
                        <div className="bg-emerald-600 rounded-lg px-3 py-2.5 text-center shadow-sm min-w-[110px]">
                          <p className="text-[10px] text-emerald-100">Order Mentah ke Petani</p>
                          <p className="text-base font-black text-white">{item._cek.orderKg.toLocaleString('id-ID')} kg</p>
                          {yl > 0 && (
                            <p className="text-[9px] text-emerald-200 mt-0.5">÷ (1 − {yl}%)</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Harga & total — read-only from system */}
                    {hargaPetani > 0 ? (
                      <div className="bg-white rounded-lg border border-amber-100 p-3 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <div>
                            <p className="text-[10px] text-slate-400 mb-0.5">Harga dari Petani (harga gudang)</p>
                            <p className="font-bold text-slate-800">Rp {hargaPetani.toLocaleString('id-ID')} / kg</p>
                          </div>
                          <span className="text-slate-300 text-lg">×</span>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-0.5">Jumlah Order Mentah</p>
                            <p className="font-bold text-slate-800">{item._cek.orderKg.toLocaleString('id-ID')} kg</p>
                          </div>
                          <span className="text-slate-300 text-lg">=</span>
                          <div>
                            <p className="text-[10px] text-slate-400 mb-0.5">Total Estimasi Biaya</p>
                            <p className="font-black text-emerald-700 text-sm">{fmtRp(totalBiaya)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Harga petani belum tersedia di data produk.</p>
                    )}
                  </div>

                  {/* Send button */}
                  <button
                    onClick={() => handleBuatPermintaan(item)}
                    disabled={isLoading}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60 active:scale-[0.98] shadow-md shadow-emerald-200"
                  >
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    {isLoading
                      ? 'Mengirim ke petani...'
                      : `Pesan ${item._cek.orderKg.toLocaleString('id-ID')} kg ke Petani${hargaPetani > 0 ? ` · ${fmtRp(totalBiaya)}` : ''}`
                    }
                  </button>
                </div>
              </div>
            );
          })}
          </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const PermintaanPengadaanPage: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);

  const [myGudangId, setMyGudangId] = useState<string | null>(null);
  const [demandData, setDemandData] = useState<DemandSignalData | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [globalTrends, setGlobalTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const qTab = queryParams.get('tab');
  const [activeTab, setActiveTab] = useState<'manual' | 'sinyal'>(
    qTab === 'sinyal' ? 'sinyal' : (location.state?.activeTab === 'sinyal' ? 'sinyal' : 'manual')
  );
  const [activePeriod, setActivePeriod] = useState<'minggu' | 'bulan' | 'tahun' | 'semua'>('bulan');
  const [formItem, setFormItem] = useState<DemandItem | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);

  // Ambil gudang user
  useEffect(() => {
    if (user?.managedWarehouses && user.managedWarehouses.length > 0) {
      setMyGudangId(user.managedWarehouses[0].id);
    }
  }, [user]);

  const fetchDemandSignal = async () => {
    if (!myGudangId) return;
    setLoading(true);
    try {
      let periodParam = 'MONTH';
      if (activePeriod === 'minggu') periodParam = 'WEEK';
      else if (activePeriod === 'tahun') periodParam = 'YEAR';
      else if (activePeriod === 'semua') periodParam = '6_MONTHS';

      const [res, topRes, globalRes] = await Promise.all([
        axios.get(`${API}/permintaan-pengadaan/demand-signal`, {
          params: { gudangId: myGudangId, period: periodParam },
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/gudang/${myGudangId}/analytics/produk-terlaris`, {
          params: { limit: 5, period: periodParam },
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/gudang/${myGudangId}/analytics/tren-komoditas-global`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      const payload = res.data?.data || res.data;
      setDemandData(payload);
      
      setTopProducts(topRes.data.data?.data || []);
      setGlobalTrends(globalRes.data.data?.data || []);
    } catch (err) {
      console.error('Gagal ambil demand signal:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermintaanList = async () => {
    // Dipindahkan ke DaftarPermintaanPage
  };

  useEffect(() => {
    if (myGudangId) {
      fetchDemandSignal();
      fetchPermintaanList();
    }
  }, [myGudangId, activePeriod]);

  // handleKirim removed

  const handleFormSuccess = () => {
    setFormItem(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wheat size={24} className="text-emerald-600" />
            Permintaan Pengadaan
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pantau tren pasar dari seller afiliasi → buat permintaan pengadaan → kirim ke kepala petani
          </p>
        </div>
        <button
          onClick={() => { fetchDemandSignal(); fetchPermintaanList(); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['manual', 'sinyal'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'manual' ? (
              <span className="flex items-center gap-1.5"><Package size={14} /> Order Sayur Segar</span>
            ) : (
              <span className="flex items-center gap-1.5"><TrendingUp size={14} /> Sinyal Pasar</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB: Sinyal Pasar ── */}
      {activeTab === 'sinyal' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['minggu', 'bulan', 'tahun', 'semua'] as const).map(p => (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  activePeriod === p
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {p === 'semua' ? 'Semua Waktu' : `${p} Ini`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
            </div>
          ) : !demandData ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <AlertTriangle size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm">Tidak dapat mengambil data dari ECOMMERCE service.</p>
              <p className="text-xs text-gray-400 mt-1">Pastikan ECOMMERCE backend berjalan di port 4000.</p>
            </div>
          ) : demandData && demandData.period ? (
            <>
              {/* Dashboard Top Widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Widget 1: Top 5 Produk Terlaris */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
                    <h2 className="font-bold text-amber-900 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-600" />
                      Top 5 Produk Terlaris
                    </h2>
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-md capitalize">{activePeriod} Ini</span>
                  </div>
                  <div className="p-4 flex-1">
                    {topProducts.length > 0 ? (
                      <div className="space-y-4">
                        {topProducts.map((cat: any) => {
                          const kategoriNama = cat.kategoriNama || cat.kategori?.nama || "Kategori";
                          const kategoriId = cat.kategori?.id || kategoriNama;
                          const productsList = cat.produk || cat.topProduk || [];
                          
                          return (
                          <div key={kategoriId}>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{kategoriNama}</h3>
                            <div className="space-y-2">
                              {productsList.map((pWrapper: any, idx: number) => {
                                const p = pWrapper.produk || pWrapper;
                                const pId = p.id || idx;
                                const tokoNama = pWrapper.toko?.nama || p.tokoNama || "Toko";
                                const totalTerjual = pWrapper.jumlahTerjual || p.totalTerjual || 0;
                                const kodeKomoditasGlobal = p.kodeKomoditasGlobal || null;
                                
                                return (
                                <div key={pId} className="group flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>
                                      {idx + 1}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-800 text-sm">{p.nama}</p>
                                      <p className="text-xs text-gray-500">{tokoNama}</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-3">
                                    <div className="group-hover:hidden">
                                      <p className="font-bold text-gray-900 text-sm">{totalTerjual} <span className="text-xs font-normal text-gray-500">terjual</span></p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setFormItem({
                                          komoditasNama: p.nama,
                                          kodeKomoditasGlobal: kodeKomoditasGlobal,
                                          masterProdukId: pId,
                                          jumlahTerjualKg: p.totalTerjual || 0,
                                          prevJumlahTerjualKg: 0,
                                          totalRevenue: p.revenue || 0,
                                          jumlahTransaksi: 0,
                                          trendPersen: null,
                                          trendArah: 'STABLE',
                                          jumlahSeller: 1,
                                        });
                                      }}
                                      className="hidden group-hover:flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                      title="Ajukan Pengadaan ke Petani"
                                    >
                                      <Plus size={12} /> Ajukan
                                    </button>
                                  </div>
                                </div>
                              );
                              })}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-gray-400">
                        <Trophy className="w-8 h-8 mb-2 text-gray-200" />
                        <p className="text-sm">Belum ada data produk terlaris.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Widget 2: Tren Komoditas Global */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                    <h2 className="font-bold text-blue-900 flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-blue-600" />
                      Tren Komoditas Global
                    </h2>
                    <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-md">MoM Growth</span>
                  </div>
                  <div className="p-4 flex-1">
                    {globalTrends.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {globalTrends.map((trend: any) => (
                          <div key={trend.kodeKomoditasGlobal} className="border border-gray-100 rounded-xl p-3 bg-gray-50 hover:bg-white hover:shadow-sm transition-all">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-semibold text-gray-800">{trend.komoditasNama}</p>
                              <div className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${trend.trendArah === 'UP' ? 'bg-emerald-100 text-emerald-700' : trend.trendArah === 'DOWN' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>
                                {trend.trendArah === 'UP' ? <TrendingUp className="w-3 h-3" /> : trend.trendArah === 'DOWN' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {trend.trendPersen}%
                              </div>
                            </div>
                            <div className="flex justify-between items-end text-xs text-gray-500">
                              <div>
                                <p>Bulan ini: <span className="font-semibold text-gray-700">{trend.jumlahTerjualKgBulanIni} kg</span></p>
                                <p>Bulan lalu: {trend.jumlahTerjualKgBulanLalu} kg</p>
                              </div>
                              <p className="font-medium text-blue-600">{trend.jumlahSellerMenjual} Penjual</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-gray-400">
                        <BarChart2 className="w-8 h-8 mb-2 text-gray-200" />
                        <p className="text-sm">Belum ada data tren komoditas global.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Info summary */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 text-sm">
                    {demandData.period?.label} · {demandData.totalTokoAfiliasi} seller afiliasi
                  </p>
                  <p className="text-xs text-emerald-600">
                    {demandData.data.length} komoditas terdeteksi · vs {demandData.prevPeriod?.label}
                  </p>
                </div>
              </div>

              {demandData.data.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
                  <Package size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-500 text-sm">Belum ada data penjualan dari seller afiliasi bulan ini.</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-50">
                    <h2 className="font-bold text-gray-800 text-sm">Top Komoditas dari Seller Afiliasi</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Klik baris untuk detail · Klik "Buat Permintaan" untuk aksi</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {demandData.data.map((item, idx) => {
                      const isUp = item.trendArah === 'UP';
                      const isDown = item.trendArah === 'DOWN';
                      const isExpanded = expandedSignal === item.komoditasNama;

                      return (
                        <div key={item.komoditasNama}>
                          <button
                            onClick={() => setExpandedSignal(isExpanded ? null : item.komoditasNama)}
                            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                          >
                            {/* Rank */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' :
                              idx === 1 ? 'bg-gray-100 text-gray-600' :
                              idx === 2 ? 'bg-orange-50 text-orange-600' :
                              'bg-gray-50 text-gray-400'
                            }`}>
                              {idx + 1}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-800">{item.komoditasNama}</p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-500">{fmtKg(item.jumlahTerjualKg)} terjual</span>
                                <span className="text-xs text-gray-300">·</span>
                                <span className="text-xs text-gray-500">{item.jumlahSeller} seller</span>
                                <span className="text-xs text-gray-300">·</span>
                                <span className="text-xs text-gray-500">{item.jumlahTransaksi} transaksi</span>
                              </div>
                            </div>

                            {/* Tren */}
                            <div className="text-right flex-shrink-0">
                              <div className={`flex items-center gap-1 justify-end text-sm font-bold ${
                                isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                {isUp ? <TrendingUp size={14} /> : isDown ? <TrendingDown size={14} /> : <Minus size={14} />}
                                {item.trendPersen !== null ? `${item.trendPersen > 0 ? '+' : ''}${item.trendPersen}%` : '-'}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{fmtRp(item.totalRevenue)}</p>
                            </div>

                            {/* Expand indicator */}
                            <div className="text-gray-300 flex-shrink-0">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="bg-emerald-50/50 border-t border-emerald-100 px-6 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                  { label: 'Terjual Bulan Ini', value: fmtKg(item.jumlahTerjualKg) },
                                  { label: 'Terjual Bulan Lalu', value: fmtKg(item.prevJumlahTerjualKg) },
                                  { label: 'Total Revenue', value: fmtRp(item.totalRevenue) },
                                  { label: 'Jumlah Seller', value: `${item.jumlahSeller} toko` },
                                ].map(s => (
                                  <div key={s.label} className="bg-white rounded-xl p-3">
                                    <p className="text-[10px] text-gray-400">{s.label}</p>
                                    <p className="font-bold text-sm text-gray-800 mt-0.5">{s.value}</p>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => setFormItem(item)}
                                className="flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200"
                              >
                                <Plus size={15} /> Buat Permintaan Pengadaan
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <AlertTriangle size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm">Data permintaan pasar tidak lengkap.</p>
              <p className="text-xs text-gray-400 mt-1">Silakan coba refresh halaman atau hubungi administrator.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Manual (dari Stok Gudang) ── */}
      {activeTab === 'manual' && myGudangId && (
        <FormManualFromStok
          gudangId={myGudangId}
          token={token}
          initialKomoditas={location.state?.selectedKomoditas}
          prefilledItems={location.state?.prefilledItems}
          onSuccess={() => { /* no-op or refresh if needed */ }}
        />
      )}
      {activeTab === 'manual' && !myGudangId && (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <AlertTriangle size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 text-sm">Gudang belum terdeteksi. Pastikan Anda login sebagai admin gudang.</p>
        </div>
      )}



      {/* Form Modal */}
      {formItem && myGudangId && (
        <FormBuatPermintaan
          item={formItem}
          gudangId={myGudangId}
          onSuccess={handleFormSuccess}
          onClose={() => setFormItem(null)}
        />
      )}
    </div>
  );
};

export default PermintaanPengadaanPage;
