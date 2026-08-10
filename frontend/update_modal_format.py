import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change generateResumeData to format string as "ukuran kg : pack"
old_push = "groups[d.produkNama].packs.push(`${d.totalPackKurang} pack ${d.ukuranKg} kg`);"
new_push = "groups[d.produkNama].packs.push(`${d.ukuranKg} kg : ${d.totalPackKurang} pack`);"
content = content.replace(old_push, new_push)

# Change rendering of detail kemasan
old_render = """                <p className="text-sm font-medium text-blue-900">
                  {data.packs.join(' dan ')}
                </p>"""

new_render = """                <div className="text-sm font-medium text-blue-900 flex flex-col gap-0.5 mt-1">
                  {data.packs.map((packStr, idx) => (
                    <div key={idx} className="flex items-center gap-2 before:content-['•'] before:text-blue-400">
                      {packStr}
                    </div>
                  ))}
                </div>"""
content = content.replace(old_render, new_render)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
