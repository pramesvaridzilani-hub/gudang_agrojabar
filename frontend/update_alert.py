import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import message
if "import { message }" not in content:
    content = content.replace("import {", "import { message }\nfrom 'antd';\nimport {", 1)

old_alert_1 = "alert(`Kapasitas produksi harian maksimal 1000 kg bahan mentah. Total semua kebutuhan adalah ${totalGross} kg. Silakan pilih satu per satu secara manual.`);"
new_alert_1 = "message.warning(`Kapasitas maksimal 1000 kg. Total pilihan ${totalGross} kg. Pilih manual.`);"
content = content.replace(old_alert_1, new_alert_1)

old_alert_2 = "alert(`Kapasitas produksi harian maksimal 1000 kg bahan mentah.\\n\\nKombinasi yang Anda pilih akan mencapai ${currentGross + thisGross} kg mentah.\\nSilakan buat jadwal terpisah untuk sisanya.`);"
new_alert_2 = "message.warning(`Kapasitas maksimal 1000 kg mentah. Kombinasi mencapai ${currentGross + thisGross} kg.`);"
content = content.replace(old_alert_2, new_alert_2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
