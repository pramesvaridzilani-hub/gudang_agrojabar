import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
old_imports = """import { message, Modal }
from 'antd';"""
new_imports = """import { message, Modal, Calendar, Badge }
from 'antd';
import dayjs, { Dayjs } from 'dayjs';"""
content = content.replace(old_imports, new_imports)

# 2. Add selectedDate state and showCalendar state
old_state = """  const [selectedDemands, setSelectedDemands] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);"""
new_state = """  const [selectedDemands, setSelectedDemands] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);"""
content = content.replace(old_state, new_state)

# 3. Add dateCellRender logic inside the component
# I will put it right before `return (`
old_stats = """  // Summary stats
  const stats = {"""

new_stats = """  const dateCellRender = (value: Dayjs) => {
    // Cari apakah ada jadwal aktif di tanggal ini
    const listData = jadwalList.filter(j => {
      if (j.statusJadwal !== 'AKTIF') return false;
      const jDate = dayjs(j.tenggatWaktu);
      return jDate.isSame(value, 'day');
    });

    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        {listData.map(item => (
          <div key={item.id} className="w-1.5 h-1.5 rounded-full bg-red-500 mb-0.5" title={`Jadwal Aktif: ${item.nomorJadwal}`} />
        ))}
      </div>
    );
  };

  // Summary stats
  const stats = {"""
content = content.replace(old_stats, new_stats)

# 4. Modify Modal to include Calendar and navigation
old_modal_end = """          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
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
                navigate('baru', { state: { selectedItems } });
              }}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
            >
              <span>Ya, Lanjut Buat Jadwal</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Modal>"""

new_modal_end = """          {/* Pemilihan Tanggal */}
          <div className="mt-4">
            {!showCalendar ? (
              <button
                onClick={() => setShowCalendar(true)}
                className="w-full py-3 border border-dashed border-emerald-300 rounded-xl text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors flex justify-center items-center gap-2"
              >
                <CalendarDays size={18} />
                Pilih Tanggal Jadwal Produksi (Opsional)
              </button>
            ) : (
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                <div className="flex justify-between items-center mb-2 px-2">
                  <span className="font-semibold text-gray-700">Pilih Tanggal:</span>
                  <button onClick={() => { setShowCalendar(false); setSelectedDate(null); }} className="text-xs text-red-500 font-medium hover:underline">Batal</button>
                </div>
                <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                  <Calendar 
                    fullscreen={false} 
                    value={selectedDate || dayjs()}
                    onSelect={(date) => setSelectedDate(date)}
                    fullCellRender={(date) => {
                      const listData = jadwalList.filter(j => j.statusJadwal === 'AKTIF' && dayjs(j.tenggatWaktu).isSame(date, 'day'));
                      const isSelected = selectedDate && date.isSame(selectedDate, 'day');
                      return (
                        <div className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm cursor-pointer transition-colors ${isSelected ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`}>
                          {date.date()}
                          {listData.length > 0 && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {listData.map((_, i) => <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`} />)}
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 px-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> 
                  Titik merah menandakan ada jadwal produksi lain di hari tersebut.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => { setShowConfirmModal(false); setShowCalendar(false); setSelectedDate(null); }}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
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
              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
            >
              <span>Ya, Lanjut Buat Jadwal</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Modal>"""
content = content.replace(old_modal_end, new_modal_end)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
