import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
if "import { message, Modal }" not in content:
    content = content.replace("import { message }\nfrom 'antd';", "import { message, Modal }\nfrom 'antd';", 1)

# 2. Add state
old_state = """  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemands, setSelectedDemands] = useState<any[]>([]);"""

new_state = """  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemands, setSelectedDemands] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);"""
content = content.replace(old_state, new_state)

# 3. Add generateResumeData
old_stats = """  // Summary stats
  const stats = {"""

new_stats = """  const generateResumeData = () => {
    const groups: Record<string, { net: number, gross: number, packs: string[] }> = {};
    const YIELD_LOSS_MAP: Record<string, number> = { Wortel: 35, Jagung: 70, Buncis: 7 };
    
    selectedDemands.forEach(d => {
      const loss = YIELD_LOSS_MAP[d.produkNama] || 0;
      const net = d.totalKgKurang;
      const gross = Math.ceil(net / (1 - (loss / 100)));
      
      if (!groups[d.produkNama]) {
        groups[d.produkNama] = { net: 0, gross: 0, packs: [] };
      }
      
      groups[d.produkNama].net += net;
      groups[d.produkNama].gross += gross;
      groups[d.produkNama].packs.push(`${d.totalPackKurang} pack ${d.ukuranKg} kg`);
    });
    
    return groups;
  };

  // Summary stats
  const stats = {"""
content = content.replace(old_stats, new_stats)

# 4. Change the "Buat Jadwal Gabungan" button behavior
old_btn = """                    onClick={() => {
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
                      navigate('baru', { state: { selectedItems } });
                    }}"""

new_btn = """                    onClick={() => setShowConfirmModal(true)}"""
content = content.replace(old_btn, new_btn)

# 5. Add Modal to the end of the return statement
old_end = """    </div>
  );
};

export default JadwalProduksiPage;"""

new_end = """    </div>

      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-600 pb-2 border-b">
            <CheckCircle2 size={24} />
            <span className="text-lg font-bold">Konfirmasi Jadwal Produksi Gabungan</span>
          </div>
        }
        open={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        footer={null}
        width={600}
        centered
        className="rounded-2xl overflow-hidden"
      >
        <div className="mt-4 flex flex-col gap-4">
          {Object.entries(generateResumeData()).map(([nama, data]) => (
            <div key={nama} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-800">{nama}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">HASIL JADI (NET)</p>
                  <p className="text-lg font-bold text-emerald-700">{data.net} kg</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                  <p className="text-xs text-amber-600 font-semibold mb-1">BAHAN BAKU (GROSS)</p>
                  <p className="text-lg font-bold text-amber-700">{data.gross} kg</p>
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold mb-1">DETAIL KEMASAN</p>
                <p className="text-sm font-medium text-blue-900">
                  {data.packs.join(' dan ')}
                </p>
              </div>
            </div>
          ))}

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
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
      </Modal>
  );
};

export default JadwalProduksiPage;"""
content = content.replace(old_end, new_end)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
