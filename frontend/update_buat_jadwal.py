import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_form = """  // ── Form State ──
  const [form, setForm] = useState({
    tenggat: '',"""

new_form = """  // ── Form State ──
  const [form, setForm] = useState({
    tenggat: state?.selectedDate ? state.selectedDate.split('T')[0] : '',"""
content = content.replace(old_form, new_form)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
