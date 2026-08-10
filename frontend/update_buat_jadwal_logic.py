import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update States
state_old = """  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stokData, setStokData] = useState<any[]>([]);"""

state_new = """  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stokData, setStokData] = useState<any[]>([]);
  const [orderedDeficits, setOrderedDeficits] = useState<Record<string, string>>({});
  const [orderLoading, setOrderLoading] = useState<Record<string, boolean>>({});"""

content = content.replace(state_old, state_new)

# Update form readiness
ready_old = """  const isFormReady =
    items.every(it => {
      const vol = parseFloat(it.volumeKg);
      const stock = stokData.find(s => s.nama === it.nama)?.stok || 0;
      return it.nama.trim() !== '' && vol > 0 && vol <= stock;
    }) &&
    items.length > 0 &&
    form.tenggat !== '';

  // ── Auto-hitung preview saat form berubah ──
  const hitungPreview = useCallback(async () => {
    if (!isFormReady) return;"""

ready_new = """  const isPreviewReady =
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
    if (!isPreviewReady) return;"""

content = content.replace(ready_old, ready_new)

# Update hitungPreview dependencies
dep_old = """  }, [totalVolumeKg, form.tenggat, form.kapasitasHarianKg, isFormReady]);"""
dep_new = """  }, [totalVolumeKg, form.tenggat, form.kapasitasHarianKg, isPreviewReady]);"""
content = content.replace(dep_old, dep_new)

# Update handleSimpan to include PermintaanPengadaanIds (if we want to link them later)
simpan_old = """        permintaanPengadaanId: form.permintaanPengadaanId.trim() || undefined,
        catatanJadwal: form.catatanJadwal.trim() || undefined,
        detailKomoditas: items,
      });
      setSaved(true);
      setTimeout(() => navigate(`/kepala-gudang/pemrosesan/sortir`), 800);
    } catch (e: any) {
      setSaveError(e?.response?.data?.error || 'Gagal menyimpan jadwal');
    } finally {
      setSaveLoading(false);
    }
  };"""

simpan_new = """        permintaanPengadaanId: Object.values(orderedDeficits)[0] || form.permintaanPengadaanId.trim() || undefined,
        catatanJadwal: form.catatanJadwal.trim() || undefined,
        detailKomoditas: items,
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
  };"""

content = content.replace(simpan_old, simpan_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
