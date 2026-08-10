import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { jadwalProduksiApi, JadwalProduksi } from '../../api/jadwal-produksi.api';
import { Loader2, PlayCircle, X, CheckCircle, Package, Users, FileCheck2, AlertCircle, Camera, Plus, Trash2 } from 'lucide-react';

const BUNCIS_SOP = ['Penimbangan Awal', 'Pemotongan', 'Pencucian', 'Perebusan Blanching', 'Perendaman Air Es', 'Penirisan', 'Penimbangan Akhir', 'Packing Vacum'];
const WORTEL_SOP = ['Penimbangan Awal', 'Pencucian 1', 'Pengupasan Kulit', 'Pencucian 2', 'Pemotongan', 'Penyortiran', 'Perebusan Blanching', 'Perendaman Air Es', 'Penirisan', 'Penimbangan Akhir'];
const JAGUNG_SOP = ['Penimbangan Awal', 'Pencucian', 'Perebusan Blanching', 'Perendaman Air Es', 'Penirisan', 'Penimbangan Akhir'];

const YIELD_LOSS_MAP: Record<string, number> = {
  Wortel: 35,
  Jagung: 70,
  Buncis: 7,
};

const getSopByKomoditas = (nama: string) => {
  const nm = nama.toLowerCase();
  if (nm.includes('buncis')) return BUNCIS_SOP;
  if (nm.includes('wortel')) return WORTEL_SOP;
  if (nm.includes('jagung')) return JAGUNG_SOP;
  return ['Penimbangan Awal', 'Pencucian', 'Sortir', 'Pengemasan'];
};

const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

type PekerjaInput = { id: string; namaPegawai: string; kgDikerjakan: string };

const PemrosesanSortirPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const gudangId = (user?.managedWarehouses as any[])?.[0]?.id || '';

  const [items, setItems] = useState<JadwalProduksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<JadwalProduksi | null>(null);

  // Form State
  const [pekerjaListMap, setPekerjaListMap] = useState<Record<number, PekerjaInput[]>>({});
  const [tarifPekerjaMap, setTarifPekerjaMap] = useState<Record<number, string>>({});
  
  // State per komoditas: checklist SOP, catatan gagal, hasil kemasan
  const [checklist, setChecklist] = useState<Record<number, Record<string, boolean>>>({});
  const [catatanGagal, setCatatanGagal] = useState<Record<number, string>>({});
  
  // Packaging states
  const [kemasan1kg, setKemasan1kg] = useState<Record<number, string>>({});
  const [kemasan2_5kg, setKemasan2_5kg] = useState<Record<number, string>>({});
  const [kemasanCustomPack, setKemasanCustomPack] = useState<Record<number, string>>({});
  const [kemasanCustomSize, setKemasanCustomSize] = useState<Record<number, string>>({});
  
  const [hasilTimbang, setHasilTimbang] = useState<Record<number, string>>({});
  
  // Photo proof state
  const [fotoBukti, setFotoBukti] = useState<string | null>(null);

  // HPP Calculator states
  const [hppBahanBaku, setHppBahanBaku] = useState<Record<number, string>>({});
  const [hppTenagaKerja, setHppTenagaKerja] = useState<Record<number, string>>({});
  const [hppKemasan, setHppKemasan] = useState<Record<number, string>>({});
  const [hppBahanLain, setHppBahanLain] = useState<Record<number, string>>({});
  const [hppOverhead, setHppOverhead] = useState<Record<number, string>>({});
  
  // Margin & Harga Jual states
  const [inputHargaJual, setInputHargaJual] = useState<Record<number, string>>({});
  const [inputMarginPersen, setInputMarginPersen] = useState<Record<number, string>>({});
  const [marginMode, setMarginMode] = useState<Record<number, 'HARGA' | 'PERSEN'>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    if (!gudangId) return;
    try {
      const res = await jadwalProduksiApi.getList({ gudangId, statusJadwal: 'AKTIF' });
      setItems(res || []);
    } catch (error) {
      console.error('Error fetching jadwal aktif:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [gudangId]);

  // ── Auto-update HPP Tenaga Kerja saat pekerjaListMap atau tarifPekerjaMap berubah ──
  useEffect(() => {
    if (!modal?.detailKomoditas) return;
    const newHppTenagaKerja = { ...hppTenagaKerja };
    let changed = false;

    modal.detailKomoditas.forEach((_: any, idx: number) => {
      const list = pekerjaListMap[idx] || [];
      const tarif = parseFloat(tarifPekerjaMap[idx] || '1500') || 1500;
      const totalUpah = list.reduce((sum, p) => sum + (parseFloat(p.kgDikerjakan) || 0) * tarif, 0);
      
      const currentVal = hppTenagaKerja[idx] || '';
      const newValStr = totalUpah > 0 ? totalUpah.toString() : '';
      if (currentVal !== newValStr) {
        newHppTenagaKerja[idx] = newValStr;
        changed = true;
      }
    });

    if (changed) {
      setHppTenagaKerja(newHppTenagaKerja);
    }
  }, [pekerjaListMap, tarifPekerjaMap, modal]);

  const openModal = (jadwal: JadwalProduksi) => {
    setModal(jadwal);
    
    const initialPekerjaMap: Record<number, PekerjaInput[]> = {};
    const initialTarifMap: Record<number, string> = {};
    const initHppBahanBaku: Record<number, string> = {};
    
    if (jadwal.detailKomoditas && Array.isArray(jadwal.detailKomoditas)) {
      jadwal.detailKomoditas.forEach((dk: any, idx: number) => {
        initialPekerjaMap[idx] = [{ id: Date.now().toString() + '_' + idx, namaPegawai: '', kgDikerjakan: '' }];
        initialTarifMap[idx] = dk.tarifPekerja ? String(dk.tarifPekerja) : '1500';
        if (dk.estimasiBahanBakuRp) {
          initHppBahanBaku[idx] = dk.estimasiBahanBakuRp.toString();
        }
      });
    }
    
    setPekerjaListMap(initialPekerjaMap);
    setTarifPekerjaMap(initialTarifMap);
    setChecklist({});
    setCatatanGagal({});
    setKemasan1kg({});
    setKemasan2_5kg({});
    setKemasanCustomPack({});
    setKemasanCustomSize({});
    setHasilTimbang({});
    setFotoBukti(null);
    setHppBahanBaku(initHppBahanBaku);
    setHppTenagaKerja({});
    setHppKemasan({});
    setHppBahanLain({});
    setHppOverhead({});
    setInputHargaJual({});
    setInputMarginPersen({});
    setMarginMode({});
  };

  const handleCheckbox = (komoditasIndex: number, step: string, checked: boolean) => {
    setChecklist(prev => ({
      ...prev,
      [komoditasIndex]: {
        ...(prev[komoditasIndex] || {}),
        [step]: checked
      }
    }));
  };

  const isAllChecked = (komoditasIndex: number, sopList: string[]) => {
    const checks = checklist[komoditasIndex] || {};
    return sopList.every(step => checks[step] === true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setFotoBukti(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getEstimasiHasil = (nama: string, rawVolume: number) => {
    // Cari mapping yield terdekat (case insensitive)
    let yieldLoss = 0;
    const key = Object.keys(YIELD_LOSS_MAP).find(k => nama.toLowerCase().includes(k.toLowerCase()));
    if (key) yieldLoss = YIELD_LOSS_MAP[key];
    
    const penyusutanKg = rawVolume * (yieldLoss / 100);
    // Gunakan Math.round agar konsisten dengan pembulatan target di ajukan-kebutuhan
    return Math.round(Math.max(0, rawVolume - penyusutanKg));
  };

  const calculateTotalPkgKg = (idx: number) => {
    const k1 = parseFloat(kemasan1kg[idx]) || 0;
    const k25 = parseFloat(kemasan2_5kg[idx]) || 0;
    const customPack = parseFloat(kemasanCustomPack[idx]) || 0;
    const customSize = parseFloat(kemasanCustomSize[idx]) || 0;
    return (k1 * 1) + (k25 * 2.5) + (customPack * customSize);
  };

  const handleSubmit = async () => {
    if (!modal) return;
    setSubmitting(true);
    try {
      // Build Laporan Eksekusi
      const laporan = modal.detailKomoditas?.map((dk: any, idx: number) => {
        const sopList = getSopByKomoditas(dk.nama);
        const lolos = isAllChecked(idx, sopList);
        
        const rawVol = parseFloat(dk.volumeKg) || 0;
        const estimasi = getEstimasiHasil(dk.nama, rawVol);
        const timbangAkhir = parseFloat(hasilTimbang[idx]) || 0;
        
        // Cek jika penimbangan tidak sesuai estimasi (selisih > 0.1)
        const isSesuai = Math.abs(timbangAkhir - estimasi) <= 0.1;
        
        const bb = parseFloat(hppBahanBaku[idx]) || 0;
        const tk = parseFloat(hppTenagaKerja[idx]) || 0;
        const kem = parseFloat(hppKemasan[idx]) || 0;
        const bl = parseFloat(hppBahanLain[idx]) || 0;
        const oh = parseFloat(hppOverhead[idx]) || 0;
        const totalBiaya = bb + tk + kem + bl + oh;
        
        const totalOutput = calculateTotalPkgKg(idx);
        const hppPerKg = totalOutput > 0 ? (totalBiaya / totalOutput) : 0;
        
        // Kalkulasi Margin
        let finalHargaJual = 0;
        let finalMarginPersen = 0;
        let finalMarginRp = 0;

        if (marginMode[idx] === 'PERSEN') {
          finalMarginPersen = parseFloat(inputMarginPersen[idx]) || 0;
          finalHargaJual = hppPerKg + (hppPerKg * (finalMarginPersen / 100));
          finalMarginRp = finalHargaJual - hppPerKg;
        } else {
          finalHargaJual = parseFloat(inputHargaJual[idx]) || 0;
          finalMarginRp = finalHargaJual - hppPerKg;
          finalMarginPersen = hppPerKg > 0 ? (finalMarginRp / hppPerKg) * 100 : 0;
        }

        return {
          nama: dk.nama,
          targetVolumeKg: dk.volumeKg,
          estimasiHasilKg: estimasi,
          hasilPenimbanganAkhir: timbangAkhir,
          lolosSop: lolos,
          catatanQc: (!lolos || !isSesuai) ? (catatanGagal[idx] || 'Catatan tidak diisi') : null,
          hasilKemasan: lolos ? {
            kemasan1kg: parseFloat(kemasan1kg[idx]) || 0,
            kemasan2_5kg: parseFloat(kemasan2_5kg[idx]) || 0,
            customPack: parseFloat(kemasanCustomPack[idx]) || 0,
            customSize: parseFloat(kemasanCustomSize[idx]) || 0,
            totalKg: totalOutput
          } : null,
          hppDetail: {
            bahanBaku: bb,
            tenagaKerja: tk,
            kemasan: kem,
            bahanLain: bl,
            overhead: oh,
            totalBiaya: totalBiaya,
            outputKg: totalOutput,
            hppPerKg: hppPerKg,
            hargaJual: finalHargaJual,
            marginPersen: finalMarginPersen,
            marginRp: finalMarginRp
          },
          sopDilakukan: checklist[idx] || {},
          fotoBukti
        };
      });

      // Build pekerja list across all komoditas
      const pekerja: any[] = [];
      if (modal.detailKomoditas) {
        modal.detailKomoditas.forEach((dk: any, idx: number) => {
          const list = pekerjaListMap[idx] || [];
          const tarif = tarifPekerjaMap[idx] || '1500';
          list.forEach(p => {
            if (p.namaPegawai && parseFloat(p.kgDikerjakan) > 0) {
              pekerja.push({
                namaPegawai: p.namaPegawai,
                kgDikerjakan: p.kgDikerjakan,
                tarifPerKg: tarif,
                catatan: dk.nama // pass komoditas name as catatan
              });
            }
          });
        });
      }

      await jadwalProduksiApi.eksekusi(modal.id, {
        pekerja,
        laporanEksekusi: laporan,
      });

      setModal(null);
      fetchItems();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Terjadi kesalahan saat mengeksekusi produksi.');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Memuat antrean produksi...</span>
        </div>
      </div>
    );
  }

  // Validasi Keseluruhan Form
  let isFormValid = true;
  
  if (modal?.detailKomoditas) {
    modal.detailKomoditas.forEach((dk: any, idx: number) => {
      const list = pekerjaListMap[idx] || [];
      const totalKg = list.reduce((sum, p) => sum + (parseFloat(p.kgDikerjakan) || 0), 0);
      const maxVol = parseFloat(dk.volumeKg) || 0;
      
      const isOver = totalKg > maxVol;
      const allPekerjaValid = list.length > 0 && list.every(p => p.namaPegawai.trim() !== '' && parseFloat(p.kgDikerjakan) > 0);
      
      if (isOver || !allPekerjaValid) {
        isFormValid = false;
      }

      const sopList = getSopByKomoditas(dk.nama);
      const lolos = isAllChecked(idx, sopList);
      
      const rawVol = parseFloat(dk.volumeKg) || 0;
      const estimasi = getEstimasiHasil(dk.nama, rawVol);
      const timbangAkhir = parseFloat(hasilTimbang[idx]) || 0;
      const hasPenimbangan = !!hasilTimbang[idx];
      
      // Khusus untuk yang lolos, jika penimbangan beda dengan estimasi, butuh catatan
      const isSesuai = Math.abs(timbangAkhir - estimasi) <= 0.1;
      
      if (lolos) {
        if (!hasPenimbangan) isFormValid = false;
        if (!isSesuai && !catatanGagal[idx]) isFormValid = false;
      } else {
        if (!catatanGagal[idx]) isFormValid = false;
      }
    });
  } else {
    isFormValid = false;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
          <PlayCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Eksekusi Produksi</h2>
          <p className="text-xs text-slate-500">Jalankan SOP dan produksi untuk jadwal yang aktif</p>
        </div>
        <span className="ml-auto bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200">
          {items.length} Jadwal Aktif
        </span>
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Semua produksi sudah selesai dieksekusi</p>
          <p className="text-xs text-slate-400 mt-1">Tidak ada jadwal aktif saat ini</p>
        </div>
      )}

      {/* List */}
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex-1 w-full space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                    {item.komoditasNama}
                  </h4>
                  <span className="text-xs text-slate-500 font-semibold">Tenggat: {formatTanggal(item.tenggat)}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Total Volume</p>
                  <p className="text-sm font-black text-emerald-700">{item.volumeTotalKg.toLocaleString('id-ID')} Kg</p>
                </div>
              </div>

              {item.detailKomoditas && Array.isArray(item.detailKomoditas) && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 grid grid-cols-1 gap-2">
                  {item.detailKomoditas.map((dk: any, idx: number) => {
                    const rawVol = parseFloat(dk.volumeKg) || 0;
                    const estimasi = getEstimasiHasil(dk.nama, rawVol);
                    let targetKemasanText = '';
                    if (dk.kemasan === '1') targetKemasanText = 'Kemasan 1 Kg';
                    else if (dk.kemasan === '2.5') targetKemasanText = 'Kemasan 2.5 Kg';
                    else if (dk.kemasan === 'kustom') targetKemasanText = `Kemasan Custom (${dk.kemasanKustom} Kg)`;
                    else if (dk.kemasan === 'kombinasi') {
                      const packBesar = parseInt(dk.kemasanKombinasiBesar) || 0;
                      // Hitung pack 1kg: jika tersimpan di data gunakan, jika tidak hitung dari estimasi
                      const packKecil = parseInt(dk.kemasanKombinasiKecil) > 0
                        ? parseInt(dk.kemasanKombinasiKecil)
                        : Math.max(0, Math.ceil(estimasi - (packBesar * 2.5)));
                      targetKemasanText = `Kombinasi (2.5Kg: ${packBesar} pack, 1Kg: ${packKecil} pack)`;
                    }
                    else targetKemasanText = 'Tidak ditentukan';

                    return (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-2 rounded-lg border border-slate-200 text-xs gap-2">
                        <div>
                          <p className="font-bold text-slate-700">{dk.nama}</p>
                          <p className="text-[10px] text-slate-500">Bahan: {rawVol} Kg &rarr; <span className="text-emerald-600 font-semibold">Est. Jadi: {estimasi} Kg</span></p>
                        </div>
                        <div className="sm:text-right bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          <p className="text-[10px] text-slate-400">Target Kemasan</p>
                          <p className="font-semibold text-slate-700 text-[11px]">{targetKemasanText}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={() => openModal(item)}
              className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-emerald-200 shrink-0 whitespace-nowrap"
            >
              Lakukan Proses
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                Proses Produksi & QC
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-md border border-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              


              {/* Komoditas SOP Loop */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-800 border-b pb-2">Pelaksanaan SOP & Hasil Penimbangan</h4>
                
                {modal.detailKomoditas?.map((dk: any, idx: number) => {
                  const sopList = getSopByKomoditas(dk.nama);
                  const isLolos = isAllChecked(idx, sopList);
                  
                  const rawVol = parseFloat(dk.volumeKg) || 0;
                  const estimasi = getEstimasiHasil(dk.nama, rawVol);
                  
                  const timbangAkhir = parseFloat(hasilTimbang[idx]) || 0;
                  const isSesuai = Math.abs(timbangAkhir - estimasi) <= 0.1;
                  const hasPenimbangan = !!hasilTimbang[idx];
                  
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-200">
                        <span className="font-bold text-slate-800 text-sm">{dk.nama}</span>
                        <div className="flex gap-2">
                          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                            Vol Awal: {dk.volumeKg} Kg
                          </span>
                          <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            Estimasi Hasil Jadi: {estimasi.toFixed(1)} Kg
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-5">
                        {/* Pencatatan Pekerja per Komoditas */}
                        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> Pencatatan Pekerja {dk.nama} (Tarif:
                              </h4>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-emerald-800">Rp</span>
                                <input
                                  type="number"
                                  value={tarifPekerjaMap[idx] || '1500'}
                                  onChange={(e) => {
                                    setTarifPekerjaMap(prev => ({ ...prev, [idx]: e.target.value }));
                                  }}
                                  className="w-16 px-1.5 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <span className="text-xs font-bold text-emerald-800">/kg)</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                const currentList = pekerjaListMap[idx] || [];
                                setPekerjaListMap(prev => ({
                                  ...prev,
                                  [idx]: [...currentList, { id: Date.now().toString() + '_' + idx, namaPegawai: '', kgDikerjakan: '' }]
                                }));
                              }}
                              className="text-[10px] flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
                            >
                              <Plus className="w-3 h-3" /> Tambah Pekerja
                            </button>
                          </div>

                          <div className="space-y-3">
                             {(pekerjaListMap[idx] || []).map((pekerja, pIdx) => {
                               const sisaSebelumnya = rawVol - (pekerjaListMap[idx] || []).slice(0, pIdx).reduce((sum, p) => sum + (parseFloat(p.kgDikerjakan) || 0), 0);
                               return (
                                 <div key={pekerja.id} className="flex flex-col sm:flex-row gap-3 items-end bg-white p-3 rounded-lg border border-emerald-100 shadow-sm relative">
                                   <div className="flex-1 w-full">
                                     <label className="text-[10px] font-semibold text-slate-600 block mb-1">Nama Pegawai <span className="text-red-500">*</span></label>
                                     <input
                                       type="text"
                                       value={pekerja.namaPegawai}
                                       onChange={(e) => {
                                         const currentList = [...(pekerjaListMap[idx] || [])];
                                         currentList[pIdx].namaPegawai = e.target.value;
                                         setPekerjaListMap(prev => ({ ...prev, [idx]: currentList }));
                                       }}
                                       placeholder="Masukkan nama..."
                                       className="w-full border border-emerald-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                     />
                                   </div>
                                   <div className="flex-1 w-full">
                                     <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                                       Bekerja (Kg) <span className="text-red-500">*</span>
                                       <span className="text-emerald-600 font-bold ml-1.5">(Sisa: {sisaSebelumnya.toLocaleString('id-ID')} Kg)</span>
                                     </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="1"
                                      step="0.5"
                                      value={pekerja.kgDikerjakan}
                                      onChange={(e) => {
                                        const currentList = [...(pekerjaListMap[idx] || [])];
                                        currentList[pIdx].kgDikerjakan = e.target.value;
                                        setPekerjaListMap(prev => ({ ...prev, [idx]: currentList }));
                                      }}
                                      placeholder="Contoh: 100"
                                      className="w-full border border-emerald-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 pr-8"
                                    />
                                    <span className="absolute right-3 top-1.5 text-[10px] text-emerald-600 font-bold">Kg</span>
                                  </div>
                                </div>
                                <div className="w-full sm:w-1/4">
                                  <div className="text-xs text-emerald-800 font-bold py-1.5 bg-emerald-50 text-center rounded-lg border border-emerald-100">
                                    Rp {(parseFloat(pekerja.kgDikerjakan || '0') * (parseFloat(tarifPekerjaMap[idx] || '1500') || 0)).toLocaleString('id-ID')}
                                  </div>
                                  {(pekerjaListMap[idx] || []).length > 1 && (
                                    <button 
                                      onClick={() => {
                                        const currentList = (pekerjaListMap[idx] || []).filter(p => p.id !== pekerja.id);
                                        setPekerjaListMap(prev => ({ ...prev, [idx]: currentList }));
                                      }}
                                      className="absolute -top-2 -right-2 bg-white border border-red-200 text-red-500 p-1 rounded-full hover:bg-red-50 shadow-sm"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                               );
                             })}
                           </div>
                          
                          {(() => {
                            const currentList = pekerjaListMap[idx] || [];
                            const totalKg = currentList.reduce((sum, p) => sum + (parseFloat(p.kgDikerjakan) || 0), 0);
                            const maxVol = parseFloat(dk.volumeKg) || 0;
                            const isOver = totalKg > maxVol;
                            return (
                              <>
                                <div className={`mt-3 flex justify-between items-center text-[10px] font-bold p-2 rounded-lg border ${isOver ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                                  <span>Total Kinerja Pekerja ({dk.nama}): {totalKg.toLocaleString('id-ID')} Kg</span>
                                  <span>Max Volume: {maxVol.toLocaleString('id-ID')} Kg</span>
                                </div>
                                {isOver && (
                                  <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Kinerja pekerja melebihi volume bahan baku {dk.nama}!
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {/* SOP Checklist */}
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-2">Checklist SOP (Wajib centang semua untuk lulus QC):</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {sopList.map((step, sIdx) => (
                              <label key={sIdx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 p-1.5 rounded-md transition-colors border border-transparent hover:border-slate-100">
                                <input
                                  type="checkbox"
                                  checked={checklist[idx]?.[step] || false}
                                  onChange={(e) => handleCheckbox(idx, step, e.target.checked)}
                                  className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-400"
                                />
                                <span className="text-slate-700 font-medium">{step}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Hasil Penimbangan & Catatan QC */}
                        <div className={`p-4 rounded-xl border ${(!isLolos || (hasPenimbangan && !isSesuai)) ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Input Penimbangan Akhir selalu ada (karena step terakhir biasanya penimbangan) */}
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">Hasil Penimbangan Akhir <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={hasilTimbang[idx] || ''}
                                  onChange={(e) => setHasilTimbang(prev => ({...prev, [idx]: e.target.value}))}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 pr-8 font-bold text-slate-800"
                                  placeholder={`Ekspektasi: ${estimasi.toFixed(1)}`}
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">Kg</span>
                              </div>
                            </div>
                            
                            {/* Input Catatan (jika tidak lolos SOP atau berat melenceng) */}
                            {(!isLolos || (hasPenimbangan && !isSesuai)) && (
                              <div>
                                <label className={`text-[11px] font-bold block mb-1 flex items-center gap-1 ${hasPenimbangan && timbangAkhir > estimasi + 0.1 ? 'text-amber-600' : 'text-red-700'}`}>
                                  <AlertCircle className="w-3 h-3" /> 
                                  {hasPenimbangan && timbangAkhir < estimasi - 0.1 
                                    ? `Catatan QC (Otomatis Reject/Susut: ${(estimasi - timbangAkhir).toFixed(1)} kg)` 
                                    : hasPenimbangan && timbangAkhir > estimasi + 0.1
                                    ? `Catatan QC (Otomatis Surplus: ${(timbangAkhir - estimasi).toFixed(1)} kg)`
                                    : `Catatan QC (Reject / Tidak Lolos)`}
                                  <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  value={catatanGagal[idx] || ''}
                                  onChange={(e) => setCatatanGagal(prev => ({...prev, [idx]: e.target.value}))}
                                  placeholder="Contoh: Sayur busuk 2kg, atau penyusutan air berlebih..."
                                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none ${hasPenimbangan && timbangAkhir > estimasi + 0.1 ? 'border-amber-300 focus:border-amber-500' : 'border-red-300 focus:border-red-500'}`}
                                  rows={1}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Hasil Kemasan Jika Lolos */}
                        {isLolos && hasPenimbangan && (
                          <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-xl mt-3">
                            <div className="flex items-center gap-2 text-emerald-800 text-sm font-bold mb-3 border-b border-emerald-100 pb-2">
                              <Package className="w-4 h-4" /> Detail Kemasan Hasil Produksi
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Hitung target kemasan per ukuran dari dk */}
                              {(() => {
                                const packBesar = parseInt(dk.kemasanKombinasiBesar) || 0;
                                const packKecil = parseInt(dk.kemasanKombinasiKecil) > 0
                                  ? parseInt(dk.kemasanKombinasiKecil)
                                  : (dk.kemasan === 'kombinasi' ? Math.max(0, Math.ceil(estimasi - packBesar * 2.5)) : 0);

                                const target1kg = dk.kemasan === '1' ? estimasi
                                  : dk.kemasan === 'kombinasi' ? packKecil : 0;
                                const target25kg = dk.kemasan === '2.5' ? Math.ceil(estimasi / 2.5)
                                  : dk.kemasan === 'kombinasi' ? packBesar : 0;

                                return (
                                  <>
                                    {/* 1kg */}
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-slate-600">Kemasan 1 kg</label>
                                        {target1kg > 0 && (
                                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                            Target: {target1kg} pack
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={kemasan1kg[idx] || ''}
                                          onChange={(e) => setKemasan1kg(prev => ({...prev, [idx]: e.target.value}))}
                                          className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                          placeholder="0"
                                        />
                                        <span className="text-[10px] font-bold text-slate-500 w-12">pack</span>
                                      </div>
                                      <div className="text-[10px] text-emerald-600 mt-1 font-semibold text-right">
                                        = {(parseFloat(kemasan1kg[idx]) || 0) * 1} kg
                                      </div>
                                    </div>

                                    {/* 2.5kg */}
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-slate-600">Kemasan 2.5 kg</label>
                                        {target25kg > 0 && (
                                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                            Target: {target25kg} pack
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={kemasan2_5kg[idx] || ''}
                                          onChange={(e) => setKemasan2_5kg(prev => ({...prev, [idx]: e.target.value}))}
                                          className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                          placeholder="0"
                                        />
                                        <span className="text-[10px] font-bold text-slate-500 w-12">pack</span>
                                      </div>
                                      <div className="text-[10px] text-emerald-600 mt-1 font-semibold text-right">
                                        = {(parseFloat(kemasan2_5kg[idx]) || 0) * 2.5} kg
                                      </div>
                                    </div>

                                    {/* Custom */}
                                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                      <label className="text-xs font-bold text-slate-600 block mb-1">Kemasan Custom</label>
                                      <div className="flex gap-2">
                                        <div>
                                          <input
                                            type="number"
                                            value={kemasanCustomSize[idx] || ''}
                                            onChange={(e) => setKemasanCustomSize(prev => ({...prev, [idx]: e.target.value}))}
                                            className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                            placeholder="Ukuran (kg)"
                                            step="0.1"
                                          />
                                        </div>
                                        <div>
                                          <input
                                            type="number"
                                            value={kemasanCustomPack[idx] || ''}
                                            onChange={(e) => setKemasanCustomPack(prev => ({...prev, [idx]: e.target.value}))}
                                            className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                                            placeholder="Pack"
                                          />
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-emerald-600 mt-1 font-semibold text-right">
                                        = {(parseFloat(kemasanCustomPack[idx]) || 0) * (parseFloat(kemasanCustomSize[idx]) || 0)} kg
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>

                            <div className="mt-3 bg-emerald-100 p-2 rounded-lg text-center font-bold text-emerald-900 text-xs border border-emerald-200">
                              Total Berat Semua Kemasan: {calculateTotalPkgKg(idx)} Kg
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Kamera Bukti Foto */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" /> Bukti Foto Produksi (Opsional)
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Maks. 5 MB (JPG/PNG/WEBP)
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 transition-colors shadow-sm"
                    >
                      <Camera className="w-4 h-4 text-slate-500" /> Upload Foto
                    </button>
                    <p className="text-[10px] text-slate-400">Ukuran foto yang diunggah tidak boleh melebihi 5 MB.</p>
                  </div>
                  {fotoBukti && (
                    <div className="relative group">
                      <img src={fotoBukti} alt="Bukti" className="h-16 w-16 object-cover rounded-lg border border-slate-300 shadow-sm" />
                      <button 
                        onClick={() => setFotoBukti(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Kalkulator HPP */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-800 border-b pb-2">Kalkulator HPP (Harga Pokok Penjualan)</h4>
                
                {modal.detailKomoditas?.map((dk: any, idx: number) => {
                  const outKg = calculateTotalPkgKg(idx);
                  const bb = parseFloat(hppBahanBaku[idx]) || 0;
                  const tk = parseFloat(hppTenagaKerja[idx]) || 0;
                  const kem = parseFloat(hppKemasan[idx]) || 0;
                  const bl = parseFloat(hppBahanLain[idx]) || 0;
                  const oh = parseFloat(hppOverhead[idx]) || 0;
                  const totBiaya = bb + tk + kem + bl + oh;
                  const hppPerKg = outKg > 0 ? (totBiaya / outKg) : 0;

                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-emerald-50/50 px-4 py-2 border-b border-emerald-100 flex justify-between items-center">
                        <span className="font-bold text-emerald-800 text-sm">HPP - {dk.nama}</span>
                        <div className="flex gap-2">
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-bold">
                            Upah Otomatis Terisi
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Bahan Baku (Rp)</label>
                          <input type="number" value={hppBahanBaku[idx] || ''} onChange={e => setHppBahanBaku(prev => ({...prev, [idx]: e.target.value}))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Tenaga Kerja (Rp)</label>
                          <input type="number" value={hppTenagaKerja[idx] || ''} onChange={e => setHppTenagaKerja(prev => ({...prev, [idx]: e.target.value}))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Kemasan (Rp)</label>
                          <input type="number" value={hppKemasan[idx] || ''} onChange={e => setHppKemasan(prev => ({...prev, [idx]: e.target.value}))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Bahan Lainnya (Rp)</label>
                          <input type="number" value={hppBahanLain[idx] || ''} onChange={e => setHppBahanLain(prev => ({...prev, [idx]: e.target.value}))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Overhead Cost (Rp)</label>
                          <input type="number" value={hppOverhead[idx] || ''} onChange={e => setHppOverhead(prev => ({...prev, [idx]: e.target.value}))} className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none" placeholder="0" />
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-between items-center text-xs">
                        <span className="text-slate-500">Output Produksi: <strong className="text-slate-700">{outKg} kg</strong></span>
                        <div className="text-right">
                          <span className="text-slate-500 mr-2">HPP per Kg:</span>
                          <span className="font-bold text-emerald-700 text-sm">Rp {Math.round(hppPerKg).toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                      
                      <div className="p-4 border-t border-slate-100 bg-emerald-50/30">
                        <h5 className="text-[11px] font-bold text-emerald-800 mb-2">Target Harga Jual / Margin</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Target Harga Jual (Rp/Kg)</label>
                            <input 
                              type="number" 
                              value={inputHargaJual[idx] || ''} 
                              onChange={e => {
                                setMarginMode(prev => ({...prev, [idx]: 'HARGA'}));
                                setInputHargaJual(prev => ({...prev, [idx]: e.target.value}));
                              }} 
                              className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" 
                              placeholder="Misal: 15000" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Atau Target Margin (%)</label>
                            <input 
                              type="number" 
                              value={inputMarginPersen[idx] || ''} 
                              onChange={e => {
                                setMarginMode(prev => ({...prev, [idx]: 'PERSEN'}));
                                setInputMarginPersen(prev => ({...prev, [idx]: e.target.value}));
                              }} 
                              className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none" 
                              placeholder="Misal: 40" 
                            />
                          </div>
                          <div>
                            {(() => {
                              let finalHarga = 0;
                              let finalMarginRp = 0;
                              let finalMarginPersen = 0;

                              if (marginMode[idx] === 'PERSEN') {
                                finalMarginPersen = parseFloat(inputMarginPersen[idx]) || 0;
                                finalHarga = hppPerKg + (hppPerKg * (finalMarginPersen / 100));
                                finalMarginRp = finalHarga - hppPerKg;
                              } else {
                                finalHarga = parseFloat(inputHargaJual[idx]) || 0;
                                finalMarginRp = finalHarga - hppPerKg;
                                finalMarginPersen = hppPerKg > 0 ? (finalMarginRp / hppPerKg) * 100 : 0;
                              }

                              return (
                                <div className="bg-white p-2 rounded border border-emerald-100 flex flex-col justify-center h-full">
                                  <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-500">Harga Jual:</span>
                                    <span className="font-bold text-emerald-700">Rp {Math.round(finalHarga).toLocaleString('id-ID')}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] mt-1">
                                    <span className="text-slate-500">Margin:</span>
                                    <span className="font-bold text-emerald-700">Rp {Math.round(finalMarginRp).toLocaleString('id-ID')} ({finalMarginPersen.toFixed(1)}%)</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200">
              <button
                onClick={() => setModal(null)}
                className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !isFormValid}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Package className="w-4 h-4" /> Selesaikan Produksi</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PemrosesanSortirPage;
