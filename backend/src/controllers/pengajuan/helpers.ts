interface KemasanDetailItem {
  id?: string;
  ukuranKg: number;
  jumlahKemasan: number;
}

interface KonfigurasiKemasanItem {
  ukuranKg: number;
  stokKemasan: number;
}

interface ProdukGudangRef {
  id: string;
  nama: string;
  stok: number;
  stokBulk?: number;
  hargaGudang: number;
  gambarUrl?: string | null;
  masterKomoditas?: { kodeKomoditasGlobal?: string | null, persenPenyusutan?: number } | null;
  kemasan: KonfigurasiKemasanItem[];
  komposisi?: any[];
}

interface StockRequestItem {
  id: string;
  pengajuanId?: string | null;
  produkId: string;
  produkNama?: string | null;
  jumlahPermintaan: number;
  jumlahDisetujui?: number | null;
  ukuranKemasanKg?: number | null;
  jumlahKemasan?: number | null;
  totalKg?: number | null;
  kemasanDetail?: KemasanDetailItem[];
  produkGudang?: ProdukGudangRef | null;
}

interface StockRequest {
  id: string;
  tokoId: string;
  tokoNama?: string | null;
  gudangId: string;
  status: string;
  modePengemasan?: string | null;
  catatan?: string | null;
  tipePengiriman?: string | null;
  tanggalPermintaanKirim?: Date | null;
  estimasiSampai?: Date | null;
  ecommerceRequestId?: string | null;
  isPesananGrosir?: boolean | null;
  alamatKirim?: string | null;
  lat?: number | null;
  lng?: number | null;
  konsumenId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  gudang?: unknown;
  items?: StockRequestItem[];
}

export const formatStockRequest = (request: StockRequest, itemsWithConfig?: StockRequestItem[]) => {
  const itemsSource = itemsWithConfig || request.items || [];
  return {
    id: request.id,
    ecommerceRequestId: request.ecommerceRequestId,
    tokoId: request.tokoId,
    gudangId: request.gudangId,
    status: request.status,
    modePengemasan: request.modePengemasan || 'DEFAULT',
    tipePengiriman: request.tipePengiriman || 'DEFAULT',
    tanggalPermintaanKirim: request.tanggalPermintaanKirim,
    estimasiSampai: request.estimasiSampai,
    catatan: request.catatan,
    isPesananGrosir: request.isPesananGrosir || false,
    alamatKirim: request.alamatKirim,
    lat: request.lat,
    lng: request.lng,
    konsumenId: request.konsumenId,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    gudang: request.gudang,
    toko: {
      id: request.tokoId,
      nama: request.tokoNama || 'Toko Pemohon',
      slug: 'toko-pemohon',
      alamat: 'Bandung, Jawa Barat',
      telepon: '-',
      kabupaten: 'Kota Bandung',
    },
    items: itemsSource.map((item: StockRequestItem) => ({
      id: item.id,
      pengajuanId: item.pengajuanId,
      produkId: item.produkId,
      jumlahPermintaan: item.jumlahPermintaan,
      jumlahDisetujui: item.jumlahDisetujui,
      ukuranKemasanKg: item.ukuranKemasanKg,
      jumlahKemasan: item.jumlahKemasan,
      totalKg: item.totalKg,
      kemasanDetail: (item.kemasanDetail || []).map((k: KemasanDetailItem) => ({
        id: k.id,
        ukuranKg: k.ukuranKg,
        jumlahKemasan: k.jumlahKemasan
      })),
      produkGudang: item.produkGudang ? {
        id: item.produkGudang.id,
        nama: item.produkGudang.nama,
        stok: item.produkGudang.stok,
        stokBulk: item.produkGudang.stok,
        hargaGudang: item.produkGudang.hargaGudang,
        kodeKomoditasGlobal: item.produkGudang.masterKomoditas?.kodeKomoditasGlobal || null,
        kemasan: item.produkGudang.kemasan.map((k: KonfigurasiKemasanItem) => ({
          ukuranKg: k.ukuranKg,
          stokKemasan: k.stokKemasan
        })),
        komposisi: item.produkGudang.komposisi || []
      } : null,
      produk: {
        id: item.produkId,
        nama: item.produkNama || 'Produk Request',
        harga: item.produkGudang ? item.produkGudang.hargaGudang : 15000,
        satuan: 'kg',
        gambarUrl: item.produkGudang?.gambarUrl || 'https://picsum.photos/seed/product/800/600',
      },
    })),
  };
};
