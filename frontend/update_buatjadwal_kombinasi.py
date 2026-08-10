import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_state = """        kemasan: si.kemasan || '1',
        kemasanKustom: '5',
        kemasanKombinasiBesar: '0'"""

new_state = """        kemasan: si.kemasan || '1',
        kemasanKustom: '5',
        kemasanKombinasiBesar: si.kemasanKombinasiBesar || '0'"""

content = content.replace(old_state, new_state)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
