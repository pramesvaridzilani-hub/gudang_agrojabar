import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add isSaving state and Loader2 import
if "import { Loader2 } from 'lucide-react';" not in content:
    content = content.replace("from 'lucide-react';", "  Loader2,\n} from 'lucide-react';", 1)

old_state = """  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);"""
new_state = """  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [isSaving, setIsSaving] = useState(false);"""
content = content.replace(old_state, new_state)

# 2. Update the onClick logic for "Ya, Lanjut Buat Jadwal" button
old_button = """            <button
              disabled={!selectedDate}
              onClick={() => {
                const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                const selectedItems = selectedDemands.map(d => {
                    const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                    const requiredGross = Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                    return {
                      nama: d.produkNama,
                      volumeKg: String(requiredGross),
                      kemasan: String(d.ukuranKg)
                    };
                });
                setShowConfirmModal(false);
                setShowCalendar(false);
                navigate('baru', { state: { selectedItems, selectedDate: selectedDate ? selectedDate.toISOString() : null } });
              }}
              className={`px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2 ${!selectedDate ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              <span>Ya, Lanjut Buat Jadwal</span>
              <ChevronRight size={18} />
            </button>"""

new_button = """            <button
              disabled={!selectedDate || isSaving}
              onClick={async () => {
                if (!selectedDate || !gudangId) return;
                setIsSaving(true);
                try {
                  const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
                  const detailKomoditas = selectedDemands.map((d, idx) => {
                      const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
                      const requiredGross = Math.ceil(d.totalKgKurang / (1 - (loss / 100)));
                      return {
                        id: Date.now().toString() + idx,
                        nama: d.produkNama,
                        volumeKg: String(requiredGross),
                        kemasan: String(d.ukuranKg),
                        kemasanKustom: '5',
                        kemasanKombinasiBesar: '0'
                      };
                  });
                  
                  const komoditasNames = [...new Set(detailKomoditas.map(k => k.nama))].join(' & ');
                  const totalVolumeKg = detailKomoditas.reduce((sum, k) => sum + (parseFloat(k.volumeKg) || 0), 0);
                  
                  await jadwalProduksiApi.create({
                    gudangId,
                    komoditasNama: komoditasNames,
                    volumeTotalKg: totalVolumeKg,
                    tenggat: selectedDate.toISOString(),
                    kapasitasHarianKg: 1000,
                    detailKomoditas,
                  });
                  
                  message.success('Jadwal produksi berhasil dibuat!');
                  setShowConfirmModal(false);
                  setShowCalendar(false);
                  navigate('/kepala-gudang/pemrosesan/sortir');
                } catch (e: any) {
                  message.error(e?.response?.data?.error || 'Gagal menyimpan jadwal produksi');
                } finally {
                  setIsSaving(false);
                }
              }}
              className={`px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors flex items-center gap-2 ${(!selectedDate || isSaving) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <span>Simpan Jadwal Gabungan</span>}
              {!isSaving && <ChevronRight size={18} />}
            </button>"""

content = content.replace(old_button, new_button)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
