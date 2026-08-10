import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRp = (n: number) =>
  'Rp ' + n.toLocaleString('id-ID');

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const today = () =>
  new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// ─── Color palette ────────────────────────────────────────────────────────────
const GREEN_DARK  = [22, 101, 52]   as [number, number, number]; // emerald-800
const GREEN_MID   = [5, 150, 105]   as [number, number, number]; // emerald-600
const GREEN_LIGHT = [209, 250, 229] as [number, number, number]; // emerald-100
const SLATE_DARK  = [30, 41, 59]    as [number, number, number]; // slate-800
const SLATE_MID   = [100, 116, 139] as [number, number, number]; // slate-500
const SLATE_LIGHT = [241, 245, 249] as [number, number, number]; // slate-100
const WHITE       = [255, 255, 255] as [number, number, number];

// ─── Shared header banner ─────────────────────────────────────────────────────
const drawHeader = (doc: jsPDF, title: string, subtitle: string) => {
  const W = doc.internal.pageSize.getWidth();

  // Green gradient bar
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, W, 32, 'F');

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text('GUDANG AGRO', 14, 13);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GREEN_LIGHT);
  doc.text('Sistem Manajemen Gudang Pertanian', 14, 19);

  // Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(title, W - 14, 12, { align: 'right' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN_LIGHT);
  doc.text(subtitle, W - 14, 19, { align: 'right' });

  // Accent stripe
  doc.setFillColor(...GREEN_MID);
  doc.rect(0, 32, W, 2, 'F');
};

// ─── Shared info block ────────────────────────────────────────────────────────
const drawInfoBlock = (
  doc: jsPDF,
  startY: number,
  leftLines: [string, string][],
  rightLines: [string, string][],
) => {
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 28) / 2;

  doc.setFillColor(...SLATE_LIGHT);
  doc.roundedRect(14, startY, W - 28, Math.max(leftLines.length, rightLines.length) * 6 + 8, 2, 2, 'F');

  let y = startY + 7;
  leftLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_MID);
    doc.text(label, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_DARK);
    doc.text(value || '-', 20, y + 4);
    y += 10;
  });

  let y2 = startY + 7;
  rightLines.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_MID);
    doc.text(label, 14 + colW + 6, y2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_DARK);
    doc.text(value || '-', 14 + colW + 6, y2 + 4);
    y2 += 10;
  });
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const drawFooter = (doc: jsPDF, note: string) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setFillColor(...SLATE_LIGHT);
  doc.rect(0, H - 18, W, 18, 'F');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_MID);
  doc.text(note, 14, H - 10);
  doc.text(`Dicetak: ${today()}`, W - 14, H - 10, { align: 'right' });

  // Green bottom line
  doc.setFillColor(...GREEN_MID);
  doc.rect(0, H - 3, W, 3, 'F');
};

// ─── Signature block ─────────────────────────────────────────────────────────
const drawSignatureBlock = (
  doc: jsPDF,
  yStart: number,
  left: string,
  right: string,
) => {
  const W = doc.internal.pageSize.getWidth();
  const colW = (W - 28) / 2;
  const boxH = 28;

  doc.setDrawColor(...SLATE_MID);
  doc.setLineWidth(0.3);

  // Left box
  doc.roundedRect(14, yStart, colW, boxH, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_DARK);
  doc.text(left, 14 + colW / 2, yStart + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_MID);
  doc.text('Tanda Tangan & Stempel', 14 + colW / 2, yStart + boxH - 4, { align: 'center' });

  // Right box
  doc.roundedRect(14 + colW + 14, yStart, colW, boxH, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_DARK);
  doc.text(right, 14 + colW + 14 + colW / 2, yStart + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_MID);
  doc.text('Tanda Tangan & Stempel', 14 + colW + 14 + colW / 2, yStart + boxH - 4, { align: 'center' });
};

// ─── INVOICE ─────────────────────────────────────────────────────────────────
export const generateInvoicePDF = (request: any, itemUpdates: any[]) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const shortId = request.id.substring(0, 8).toUpperCase();
  const invoiceNo = `INV-${shortId}`;

  drawHeader(doc, 'INVOICE', invoiceNo);

  // ── Info block ──
  const infoY = 40;
  drawInfoBlock(
    doc,
    infoY,
    [
      ['Kepada (Pembeli)', request.toko?.nama || '-'],
      ['Alamat', request.toko?.alamat || '-'],
    ],
    [
      ['No. Invoice', invoiceNo],
      ['Tanggal Pengajuan', formatDate(request.createdAt)],
      ['Tanggal Cetak', today()],
      ['Status', request.status],
    ],
  );

  const infoH = 4 * 10 + 8;
  let curY = infoY + infoH + 6;

  // ── Gudang info ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Gudang Penyedia:', 14, curY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE_DARK);
  doc.text(`${request.gudang?.nama || '-'}   |   ${request.gudang?.alamat || '-'}`, 46, curY);
  curY += 8;

  // ── Items table ──
  const tableRows = request.items.map((item: any) => {
    const u = itemUpdates.find((x: any) => x.itemId === item.id);
    const qty = u?.jumlahDisetujui ?? item.jumlahPermintaan;
    const price = u?.hargaPerUnit ?? item.hargaPerUnit ?? 0;
    const subtotal = qty * price;
    return [
      item.produk?.nama || item.produkNama || '-',
      item.grade || '-',
      `${qty} kg`,
      formatRp(price),
      formatRp(subtotal),
    ];
  });

  const grandTotal = request.items.reduce((sum: number, item: any) => {
    const u = itemUpdates.find((x: any) => x.itemId === item.id);
    const qty = u?.jumlahDisetujui ?? item.jumlahPermintaan;
    const price = u?.hargaPerUnit ?? item.hargaPerUnit ?? 0;
    return sum + qty * price;
  }, 0);

  autoTable(doc, {
    startY: curY,
    head: [['Produk', 'Grade', 'Jumlah', 'Harga / kg', 'Subtotal']],
    body: tableRows,
    foot: [['', '', '', 'TOTAL', formatRp(grandTotal)]],
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: SLATE_DARK,
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    footStyles: {
      fillColor: GREEN_LIGHT,
      textColor: GREEN_DARK,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // @ts-expect-error lastAutoTable is added by autoTable
  curY = (doc as any).lastAutoTable.finalY + 8;

  // ── Catatan ──
  if (request.catatan) {
    doc.setFillColor(...SLATE_LIGHT);
    doc.roundedRect(14, curY, W - 28, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_MID);
    doc.text('Catatan:', 20, curY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_DARK);
    doc.text(request.catatan, 20, curY + 10);
    curY += 20;
  }

  // ── Signature ──
  curY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_DARK);
  doc.text('Tanda Tangan Para Pihak', 14, curY);
  curY += 4;
  drawSignatureBlock(doc, curY, `Pembeli\n${request.toko?.nama || ''}`, `Gudang\n${request.gudang?.nama || ''}`);

  drawFooter(doc, 'Dokumen ini diterbitkan secara elektronik oleh Sistem Gudang Agro. Berlaku tanpa tanda tangan basah.');

  doc.save(`Invoice-${invoiceNo}.pdf`);
};

// ─── BASTB ────────────────────────────────────────────────────────────────────
export const generateBASTBPDF = (request: any, itemUpdates: any[]) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  const shortId = request.id.substring(0, 8).toUpperCase();
  const bastbNo = `BASTB-${shortId}`;

  drawHeader(doc, 'BERITA ACARA SERAH TERIMA BARANG', bastbNo);

  // ── Nomor & judul resmi ──
  let curY = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_DARK);
  doc.text('BERITA ACARA SERAH TERIMA BARANG (BASTB)', W / 2, curY, { align: 'center' });
  curY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_MID);
  doc.text(`Nomor: ${bastbNo}`, W / 2, curY, { align: 'center' });
  curY += 8;

  // ── Paragraph pembuka ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_DARK);
  const opening =
    `Pada hari ini, ${today()}, kami yang bertanda tangan di bawah ini telah melakukan serah terima barang ` +
    `sesuai dengan Pengajuan No. ${shortId}, dengan rincian sebagai berikut:`;
  const splitOpening = doc.splitTextToSize(opening, W - 28);
  doc.text(splitOpening, 14, curY);
  curY += splitOpening.length * 5 + 4;

  // ── Info block ──
  drawInfoBlock(
    doc,
    curY,
    [
      ['Pihak Pertama (Penyedia / Gudang)', request.gudang?.nama || '-'],
      ['Alamat Gudang', request.gudang?.alamat || '-'],
    ],
    [
      ['Pihak Kedua (Penerima / Seller)', request.toko?.nama || '-'],
      ['Alamat Penerima', request.toko?.alamat || '-'],
      ['No. Pengajuan', shortId],
      ['Tanggal Pengajuan', formatDate(request.createdAt)],
    ],
  );

  const infoH = 4 * 10 + 8;
  curY += infoH + 8;

  // ── Items table ──
  const tableRows = request.items.map((item: any, idx: number) => {
    const u = itemUpdates.find((x: any) => x.itemId === item.id);
    const qty = u?.jumlahDisetujui ?? item.jumlahPermintaan;
    const price = u?.hargaPerUnit ?? item.hargaPerUnit ?? 0;
    const kemasan = item.kemasanDetail?.length > 0
      ? item.kemasanDetail.map((k: any) => `${k.jumlahKemasan} pack × ${k.ukuranKg} kg`).join(', ')
      : '-';
    return [
      String(idx + 1),
      item.produk?.nama || item.produkNama || '-',
      item.grade || '-',
      `${qty} kg`,
      kemasan,
      formatRp(price),
      formatRp(qty * price),
    ];
  });

  const grandTotal = request.items.reduce((sum: number, item: any) => {
    const u = itemUpdates.find((x: any) => x.itemId === item.id);
    const qty = u?.jumlahDisetujui ?? item.jumlahPermintaan;
    const price = u?.hargaPerUnit ?? item.hargaPerUnit ?? 0;
    return sum + qty * price;
  }, 0);

  autoTable(doc, {
    startY: curY,
    head: [['No', 'Nama Komoditas', 'Grade', 'Jumlah', 'Kemasan', 'Harga/kg', 'Nilai']],
    body: tableRows,
    foot: [['', '', '', '', '', 'Total Nilai', formatRp(grandTotal)]],
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: SLATE_DARK,
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
    },
    footStyles: {
      fillColor: GREEN_LIGHT,
      textColor: GREEN_DARK,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      3: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // @ts-expect-error lastAutoTable is added by autoTable
  curY = (doc as any).lastAutoTable.finalY + 8;

  // ── Pernyataan ──
  const statement =
    'Dengan ditandatanganinya berita acara ini, maka serah terima barang dinyatakan TELAH SELESAI dilakukan ' +
    'dalam kondisi baik dan sesuai dengan kesepakatan kedua belah pihak. Dokumen ini merupakan bukti sah ' +
    'serah terima dan dapat digunakan sebagai lampiran penagihan.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_DARK);
  const splitStatement = doc.splitTextToSize(statement, W - 28);
  doc.text(splitStatement, 14, curY);
  curY += splitStatement.length * 5 + 8;

  // ── Catatan ──
  if (request.catatan) {
    doc.setFillColor(...SLATE_LIGHT);
    doc.roundedRect(14, curY, W - 28, 14, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_MID);
    doc.text('Catatan:', 20, curY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_DARK);
    doc.text(request.catatan, 20, curY + 10);
    curY += 20;
  }

  // ── Signature ──
  curY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_DARK);
  doc.text('Tanda Tangan Para Pihak', 14, curY);
  curY += 4;
  drawSignatureBlock(
    doc,
    curY,
    `Pihak Pertama (Penyedia)\n${request.gudang?.nama || ''}`,
    `Pihak Kedua (Penerima)\n${request.toko?.nama || ''}`,
  );

  drawFooter(doc, `BASTB ${bastbNo} — Dokumen resmi Sistem Gudang Agro. Harap simpan sebagai arsip.`);

  doc.save(`BASTB-${bastbNo}.pdf`);
};
