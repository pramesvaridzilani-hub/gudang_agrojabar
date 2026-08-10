import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_items = """  const [items, setItems] = useState<KomoditasItem[]>([{
    id: Date.now().toString(),
    nama: initKomoditas,
    volumeKg: initVolume,
    kemasan: initKemasan,
    kemasanKustom: initKemasanKustom,
    kemasanKombinasiBesar: initKemasanKombinasiBesar
  }]);"""

new_items = """  const selectedItems = state?.selectedItems as any[];

  const [items, setItems] = useState<KomoditasItem[]>(() => {
    if (selectedItems && selectedItems.length > 0) {
      return selectedItems.map((si, idx) => ({
        id: Date.now().toString() + idx,
        nama: si.nama || '',
        volumeKg: si.volumeKg || '',
        kemasan: si.kemasan || '1',
        kemasanKustom: '5',
        kemasanKombinasiBesar: '0'
      }));
    }
    return [{
      id: Date.now().toString(),
      nama: initKomoditas,
      volumeKg: initVolume,
      kemasan: initKemasan,
      kemasanKustom: initKemasanKustom,
      kemasanKombinasiBesar: initKemasanKombinasiBesar
    }];
  });"""

content = content.replace(old_items, new_items)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
