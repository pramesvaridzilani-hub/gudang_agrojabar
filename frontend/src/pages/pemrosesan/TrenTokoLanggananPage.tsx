import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Package, 
  ArrowRight,
  RefreshCw,
  Trophy,
  BarChart2,
  ShoppingBag
} from 'lucide-react';

interface TrendData {
  kodeKomoditasGlobal: string;
  komoditasNama: string;
  jumlahTokoPasar: number;
  salesVelocityKgPerDay: number;
  trendStatus: 'NAIK_TAJAM' | 'NAIK' | 'STABIL' | 'TURUN';
  trendPersen: number;
  rekomendasiBufferKg: number;
  stokGudangSaatIni: number;
}

export default function TrenTokoLanggananPage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const gudangId = user?.managedWarehouses?.[0]?.id; // Ambil gudangId dari auth user
  const [data, setData] = useState<TrendData[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [globalTrends, setGlobalTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [prevPeriodLabel, setPrevPeriodLabel] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [demandRes, topRes, globalRes] = await Promise.all([
        api.get(`/gudang/${gudangId}/trend-toko-langganan`),
        api.get(`/gudang/${gudangId}/analytics/produk-terlaris?limit=5&period=MONTH`),
        api.get(`/gudang/${gudangId}/analytics/tren-komoditas-global`)
      ]);

      setData(demandRes.data.data);
      setLastUpdated(demandRes.data.lastUpdated);
      setPeriodLabel(demandRes.data.periodLabel);
      setPrevPeriodLabel(demandRes.data.prevPeriodLabel);
      
      setTopProducts(topRes.data.data?.data || []);
      setGlobalTrends(globalRes.data.data?.data || []);

      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Gagal memuat data tren toko langganan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gudangId) {
      fetchData();
    }
  }, [gudangId]);

  const handleBuatJadwal = (komoditas: string, targetKg: number) => {
    const rolePrefix = user?.peran === 'ADMIN_GUDANG' ? '/kepala-gudang' : '/staf';
    navigate(`${rolePrefix}/pemrosesan/jadwal-produksi/baru?komoditas=${encodeURIComponent(komoditas)}&target=${targetKg}`);
  };

  const getTrendIcon = (status: string) => {
    switch (status) {
      case 'NAIK_TAJAM': return <TrendingUp className="text-red-600 w-5 h-5" />;
      case 'NAIK': return <TrendingUp className="text-orange-500 w-5 h-5" />;
      case 'STABIL': return <Minus className="text-blue-500 w-5 h-5" />;
      case 'TURUN': return <TrendingDown className="text-gray-500 w-5 h-5" />;
      default: return null;
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Tren Pasar E-Commerce</h1>
          <p className="text-gray-500 mt-1">
            Pantau kecepatan jualan seluruh toko di platform E-Commerce dan persiapkan suplai pasar (Smart Buffer).
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Segarkan
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Dashboard Top Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Widget 1: Top 5 Produk Terlaris */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
            <h2 className="font-bold text-amber-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600" />
              Top 5 Produk Terlaris
            </h2>
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-md">Bulan Ini</span>
          </div>
          <div className="p-4 flex-1">
            {loading ? (
              <div className="flex justify-center items-center h-full min-h-[200px]"><RefreshCw className="w-6 h-6 text-amber-500 animate-spin" /></div>
            ) : topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((cat: any) => (
                  <div key={cat.kategoriNama}>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{cat.kategoriNama}</h3>
                    <div className="space-y-2">
                      {cat.produk?.map((p: any, idx: number) => (
                        <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{p.nama}</p>
                              <p className="text-xs text-gray-500">{p.tokoNama}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 text-sm">{p.totalTerjual} <span className="text-xs font-normal text-gray-500">terjual</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400">
                <Trophy className="w-10 h-10 mb-2 text-gray-200" />
                <p className="text-sm">Belum ada data produk terlaris bulan ini.</p>
              </div>
            )}
          </div>
        </div>

        {/* Widget 2: Tren Komoditas Global */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
            <h2 className="font-bold text-blue-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              Tren Komoditas Global (E-Commerce)
            </h2>
            <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-md">MoM Growth</span>
          </div>
          <div className="p-4 flex-1">
            {loading ? (
              <div className="flex justify-center items-center h-full min-h-[200px]"><RefreshCw className="w-6 h-6 text-blue-500 animate-spin" /></div>
            ) : globalTrends.length > 0 ? (
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
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400">
                <BarChart2 className="w-10 h-10 mb-2 text-gray-200" />
                <p className="text-sm">Belum ada data tren komoditas global.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-600" />
          Sinyal Kebutuhan Gudang (Demand Signal)
        </h2>
        <p className="text-sm text-gray-500 mt-1">Berdasarkan kecepatan jualan toko-toko yang disuplai gudang ini. 
        Update Terakhir: {lastUpdated ? new Date(lastUpdated).toLocaleString('id-ID') : '-'}</p>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Menganalisa data dari seluruh toko E-Commerce...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {data.map((item) => {
            const isKritis = item.stokGudangSaatIni < item.rekomendasiBufferKg;
            
            return (
              <div key={item.komoditasNama} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${isKritis ? 'border-orange-200' : 'border-gray-200'}`}>
                <div className={`p-4 border-b ${isKritis ? 'bg-orange-50' : 'bg-gray-50'} flex justify-between items-center`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-md shadow-sm border border-gray-100">
                      {getTrendIcon(item.trendStatus)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{item.komoditasNama}</h3>
                      <p className="text-xs text-gray-500">Dipantau dari {item.jumlahTokoPasar} Toko Se-Platform</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">vs {prevPeriodLabel}</p>
                    <p className={`font-semibold flex items-center justify-end gap-1 ${item.trendPersen > 0 ? 'text-red-600' : item.trendPersen < 0 ? 'text-gray-500' : 'text-blue-600'}`}>
                      {item.trendPersen > 0 ? '+' : ''}{item.trendPersen}%
                    </p>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Kecepatan Jual Harian</p>
                      <p className="text-2xl font-bold text-gray-900">{item.salesVelocityKgPerDay} <span className="text-base font-normal text-gray-500">kg/hari</span></p>
                      <p className="text-xs text-gray-400 mt-1">Rata-rata 7 hari terakhir</p>
                    </div>
                    
                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      <p className="text-sm text-emerald-800 font-medium mb-1 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Target Smart Buffer
                      </p>
                      <p className="text-2xl font-bold text-emerald-700">{item.rekomendasiBufferKg} <span className="text-base font-normal">kg</span></p>
                      <p className="text-xs text-emerald-600 mt-1">Stok aman untuk 2 hari</p>
                    </div>
                    
                    <div className={`${isKritis ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'} p-3 rounded-lg border`}>
                      <p className={`text-sm font-medium mb-1 flex items-center gap-1 ${isKritis ? 'text-red-800' : 'text-gray-700'}`}>
                        {isKritis && <AlertTriangle className="w-4 h-4" />} Stok Siap Kirim Saat Ini
                      </p>
                      <p className={`text-2xl font-bold ${isKritis ? 'text-red-700' : 'text-gray-900'}`}>{item.stokGudangSaatIni} <span className="text-base font-normal">kg</span></p>
                      <p className={`text-xs mt-1 ${isKritis ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {isKritis ? `Kekurangan ${item.rekomendasiBufferKg - item.stokGudangSaatIni} kg` : 'Stok memenuhi buffer'}
                      </p>
                    </div>
                  </div>

                  {isKritis && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-orange-800">
                        <div className="bg-orange-100 p-2 rounded-full">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Aksi Diperlukan!</p>
                          <p className="text-xs text-orange-700">Segera jadwalkan produksi pengupasan/pengemasan untuk memenuhi potensi tarikan pasar.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleBuatJadwal(item.komoditasNama, item.rekomendasiBufferKg - item.stokGudangSaatIni)}
                        className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        Buat Jadwal Produksi <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
