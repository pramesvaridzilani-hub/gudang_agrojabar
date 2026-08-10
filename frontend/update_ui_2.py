import re

file_path = 'd:/warehouse/warehouse/fe/src/pages/pemrosesan/JadwalProduksiPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Table
content = content.replace(
    '<table className="w-full text-left border-collapse min-w-[600px]">',
    '<table className="w-full text-left border-collapse min-w-[800px]">'
)

# Replace Head
old_head = '<th className="py-3 px-3 text-xs font-bold text-gray-500 text-center">Total Kebutuhan Curah</th>'
new_head = '<th className="py-3 px-3 text-xs font-bold text-gray-500 text-center">Total Kebutuhan Curah</th>\n                        <th className="py-3 px-3 text-xs font-bold text-gray-500">Pesanan Terkait</th>'
content = content.replace(old_head, new_head)

# Replace Row
old_row = """                          <td className="py-4 px-3 text-center font-semibold text-gray-700">
                            {demand.totalKgKurang} kg
                          </td>"""
new_row = """                          <td className="py-4 px-3 text-center font-semibold text-gray-700">
                            {demand.totalKgKurang} kg
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex flex-col gap-1">
                              {demand.requests?.map((req: any) => (
                                <div key={req.id} className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded inline-flex items-center gap-1 w-max">
                                  <span className="font-mono text-blue-600 font-medium">#{req.ecommerceId ? req.ecommerceId.split('-')[0] : req.id.split('-')[0]}</span>
                                  <span className="text-slate-400">({new Date(req.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'short'})})</span>
                                </div>
                              ))}
                            </div>
                          </td>"""
content = content.replace(old_row, new_row)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
