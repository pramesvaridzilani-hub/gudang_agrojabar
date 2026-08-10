import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import {
  Loader2,
  Scissors,
  Award,
  Package,
  ArchiveRestore,
  CheckCircle2,
  ArrowRight,
  Weight,
} from 'lucide-react';

interface RingkasanStats {
  total: number;
  sortir: number;
  grading: number;
  pengemasan: number;
  stok: number;
  selesai: number;
  totalBeratMasukKg: number;
}

const PemrosesanRingkasanPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RingkasanStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/pemrosesan/ringkasan');
        setStats(res.data.data);
      } catch (error) {
        console.error('Error fetching ringkasan:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Memuat data pemrosesan...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-slate-500 text-sm">
        Gagal memuat data ringkasan.
      </div>
    );
  }



  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-slate-50 border border-emerald-200 rounded-3xl p-6">
        <span className="text-xs font-semibold tracking-wider uppercase text-emerald-600">
          Pipeline Pemrosesan
        </span>
        <h2 className="text-xl font-bold mt-1 text-slate-800">
          Ringkasan Pemrosesan Gudang
        </h2>
        <p className="text-xs mt-1.5 font-light leading-relaxed max-w-xl text-slate-600">
          Monitor tahapan pemrosesan barang dari penerimaan hingga masuk stok gudang.
        </p>
      </div>

      {/* Total Berat Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
          <Weight className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs font-semibold text-slate-600">Total Berat Masuk Pipeline</span>
          <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
            {stats.totalBeratMasukKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Kg
          </h3>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          {stats.total} batch dalam proses
        </div>
      </div>


    </div>
  );
};

export default PemrosesanRingkasanPage;
