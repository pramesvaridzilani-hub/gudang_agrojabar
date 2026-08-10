import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  Clock,
  BarChart2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  X,
} from 'lucide-react';
import { gudangApi } from '../../api/gudang.api';
import { useAuthStore } from '../../store/authStore';

interface Gudang {
  id: string;
  kode: string;
  nama: string;
  tipe: string;
  alamat: string;
  kabupaten: string;
  provinsi: string;
  telepon?: string;
  email?: string;
  status: string;
  kapasitasKg: number;
  kapasitasTerpakai: number;
  jamOperasional?: string;
  catatan?: string;
  lat?: number;
  lng?: number;
}

const TIPE_OPTIONS = ['REGIONAL', 'PUSAT', 'SATELIT'];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'FULL', 'MAINTENANCE'];

const statusLabel: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Tidak Aktif',
  FULL: 'Penuh',
  MAINTENANCE: 'Maintenance',
};

const statusColor: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
  FULL: 'bg-orange-100 text-orange-800 border-orange-200',
  MAINTENANCE: 'bg-red-100 text-red-700 border-red-200',
};

const GudangDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  const [gudang, setGudang] = useState<Gudang | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Gudang>>({});

  useEffect(() => {
    if (id) fetchGudang();
  }, [id]);

  const fetchGudang = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await gudangApi.getGudangById(id!);
      const g = data.data || data;
      setGudang(g);
      setForm(g);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal memuat data gudang');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await gudangApi.updateGudang(id, {
        nama: form.nama,
        kode: form.kode?.toUpperCase(),
        tipe: form.tipe,
        alamat: form.alamat,
        kabupaten: form.kabupaten,
        provinsi: form.provinsi,
        telepon: form.telepon || undefined,
        email: form.email || undefined,
        kapasitasKg: form.kapasitasKg ? Number(form.kapasitasKg) : undefined,
        jamOperasional: form.jamOperasional || undefined,
        status: form.status,
        catatan: form.catatan || undefined,
      });
      setSuccess('Perubahan berhasil disimpan!');
      setIsEditing(false);
      fetchGudang();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (gudang) setForm(gudang);
    setIsEditing(false);
    setError(null);
  };

  const capacityPercent =
    gudang && gudang.kapasitasKg > 0
      ? Math.min(100, Math.round((gudang.kapasitasTerpakai / gudang.kapasitasKg) * 100))
      : 0;

  const capacityBarColor =
    capacityPercent > 90
      ? 'bg-red-500'
      : capacityPercent > 70
      ? 'bg-orange-500'
      : 'bg-emerald-500';

  // ─── Loading State ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Memuat data gudang...</p>
        </div>
      </div>
    );
  }

  // ─── Error: Not Found ────────────────────────────────────────────
  if (!gudang && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/gudang')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Detail Gudang</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Gudang tidak ditemukan</p>
            <p className="text-sm text-red-700 mt-1">{error || 'Data gudang dengan ID ini tidak tersedia.'}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/gudang')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-emerald-600" />
              {gudang?.nama}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Kode: {gudang?.kode}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors text-sm font-medium"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit Gudang
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 text-sm">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-emerald-700 text-sm font-medium">{success}</p>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Kapasitas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-600">
              <BarChart2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium">Kapasitas</span>
            </div>
            <span className="text-sm font-bold text-slate-700">{capacityPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${capacityBarColor}`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {(gudang?.kapasitasTerpakai ?? 0).toLocaleString('id-ID')} /{' '}
            {(gudang?.kapasitasKg ?? 0).toLocaleString('id-ID')} kg
          </p>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-600 mb-3">Status</p>
          {isEditing ? (
            <select
              name="status"
              value={form.status ?? ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${
                statusColor[gudang?.status ?? ''] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {statusLabel[gudang?.status ?? ''] ?? gudang?.status}
            </span>
          )}
        </div>

        {/* Tipe */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-sm font-medium text-slate-600 mb-3">Tipe Gudang</p>
          {isEditing ? (
            <select
              name="tipe"
              value={form.tipe ?? ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {TIPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
              {gudang?.tipe}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Informasi Utama */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Warehouse className="w-4 h-4 text-emerald-600" />
            Informasi Utama
          </h2>

          {/* Nama */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Nama Gudang <span className="text-red-500">*</span>
            </label>
            {isEditing ? (
              <input
                name="nama"
                value={form.nama ?? ''}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm text-slate-900 font-medium">{gudang?.nama}</p>
            )}
          </div>

          {/* Kode */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Kode Gudang
            </label>
            {isEditing ? (
              <input
                name="kode"
                value={form.kode ?? ''}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            ) : (
              <p className="text-sm text-slate-900 font-mono font-medium">{gudang?.kode}</p>
            )}
          </div>

          {/* Kapasitas */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Kapasitas (kg)
            </label>
            {isEditing ? (
              <input
                name="kapasitasKg"
                type="number"
                min="0"
                value={form.kapasitasKg ?? ''}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm text-slate-900 font-medium">
                {(gudang?.kapasitasKg ?? 0).toLocaleString('id-ID')} kg
              </p>
            )}
          </div>

          {/* Jam Operasional */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Jam Operasional
            </label>
            {isEditing ? (
              <input
                name="jamOperasional"
                value={form.jamOperasional ?? ''}
                onChange={handleChange}
                placeholder="08:00 - 17:00"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <p className="text-sm text-slate-900 font-medium">{gudang?.jamOperasional || '-'}</p>
            )}
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Catatan
            </label>
            {isEditing ? (
              <textarea
                name="catatan"
                value={form.catatan ?? ''}
                onChange={handleChange}
                rows={3}
                placeholder="Catatan tambahan tentang gudang ini..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            ) : (
              <p className="text-sm text-slate-900">{gudang?.catatan || '-'}</p>
            )}
          </div>
        </div>

        {/* Right: Lokasi & Kontak */}
        <div className="space-y-6">
          {/* Lokasi */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Lokasi
            </h2>

            {/* Alamat */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Alamat Lengkap <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <textarea
                  name="alamat"
                  value={form.alamat ?? ''}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              ) : (
                <p className="text-sm text-slate-900">{gudang?.alamat}</p>
              )}
            </div>

            {/* Kabupaten & Provinsi */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Kabupaten/Kota
                </label>
                {isEditing ? (
                  <input
                    name="kabupaten"
                    value={form.kabupaten ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <p className="text-sm text-slate-900 font-medium">{gudang?.kabupaten}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Provinsi
                </label>
                {isEditing ? (
                  <input
                    name="provinsi"
                    value={form.provinsi ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <p className="text-sm text-slate-900 font-medium">{gudang?.provinsi}</p>
                )}
              </div>
            </div>
          </div>

          {/* Kontak */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Phone className="w-4 h-4 text-emerald-600" />
              Kontak
            </h2>

            {/* Telepon */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Telepon
              </label>
              {isEditing ? (
                <input
                  name="telepon"
                  value={form.telepon ?? ''}
                  onChange={handleChange}
                  placeholder="022-1234567"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <p className="text-sm text-slate-900 font-medium">{gudang?.telepon || '-'}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                Email
              </label>
              {isEditing ? (
                <input
                  name="email"
                  type="email"
                  value={form.email ?? ''}
                  onChange={handleChange}
                  placeholder="gudang@agrojabar.co.id"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <p className="text-sm text-slate-900 font-medium">{gudang?.email || '-'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Save Button (Bottom, edit mode only) ── */}
      {isEditing && (
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleCancel}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors text-sm font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      )}
    </div>
  );
};

export default GudangDetailPage;
