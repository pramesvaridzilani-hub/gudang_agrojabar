import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change navigate logic after saving
old_nav = "setTimeout(() => navigate(`../${jadwal.id}`), 800);"
new_nav = "setTimeout(() => navigate(`/kepala-gudang/pemrosesan/sortir`), 800);"
content = content.replace(old_nav, new_nav)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
