import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix handleReset TS Error
reset_old = """  const handleReset = () => {
    setForm({
      
      tenggat: '',
      kapasitasHarianKg: '1000',
      catatanJadwal: '',
      pengajuanId: '',
    });"""

reset_new = """  const handleReset = () => {
    setForm({
      
      tenggat: '',
      kapasitasHarianKg: '1000',
      catatanJadwal: '',
      pengajuanId: '',
      permintaanPengadaanId: '',
    });
    setOrderedDeficits({});
    setOrderLoading({});"""

content = content.replace(reset_old, reset_new)

# Fix isFormReady TS Error
form_ready_old = """                <button
                  type="button"
                  onClick={hitungPreview}
                  disabled={!isFormReady || previewLoading}"""

form_ready_new = """                <button
                  type="button"
                  onClick={hitungPreview}
                  disabled={!isPreviewReady || previewLoading}"""

content = content.replace(form_ready_old, form_ready_new)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
