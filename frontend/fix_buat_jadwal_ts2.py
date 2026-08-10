import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/BuatJadwalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix isFormReady TS Error
form_ready_old2 = """            {!isFormReady ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">"""

form_ready_new2 = """            {!isPreviewReady ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">"""

content = content.replace(form_ready_old2, form_ready_new2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
