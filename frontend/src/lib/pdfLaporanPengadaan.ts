import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PermintaanItem {
  id: string;
  komoditasNama: string;
  targetKg: number;
  status: string;
  createdAt: string;
  nomorOrder?: string | null;
  tanggalTiba?: string | null;
  qcDetail?: any;
  rencanaProduksi?: any;
}

// ─── Color palette ────────────────────────────────────────────────────────────
const GREEN_DARK  = [22, 101, 52]   as [number, number, number];
const GREEN_MID   = [5, 150, 105]   as [number, number, number];
const GREEN_LIGHT = [209, 250, 229] as [number, number, number];
const SLATE_DARK  = [30, 41, 59]    as [number, number, number];
const SLATE_MID   = [100, 116, 139] as [number, number, number];
const SLATE_LIGHT = [241, 245, 249] as [number, number, number];
const WHITE       = [255, 255, 255] as [number, number, number];
const RED_MID     = [220, 38, 38]   as [number, number, number];
const BLUE_MID    = [59, 130, 246]  as [number, number, number];
const AMBER_MID   = [245, 158, 11]  as [number, number, number];
const INDIGO_MID  = [99, 102, 241]  as [number, number, number];
const PINK_MID    = [236, 72, 153]  as [number, number, number];

const BAR_COLORS: [number, number, number][] = [
  GREEN_MID, BLUE_MID, INDIGO_MID, AMBER_MID, PINK_MID,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtDateFull = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const today = () =>
  new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtKg = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)} ton` : `${n.toFixed(1)} kg`;

// ─── Header ───────────────────────────────────────────────────────────────────
const drawHeader = (doc: jsPDF, title: string, subtitle: string) => {
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, W, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text('GUDANG AGRO', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GREEN_LIGHT);
  doc.text('Sistem Manajemen Gudang Pertanian', 14, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(title, W - 14, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN_LIGHT);
  doc.text(subtitle, W - 14, 19, { align: 'right' });

  doc.setFillColor(...GREEN_MID);
  doc.rect(0, 32, W, 2, 'F');
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const drawFooter = (doc: jsPDF) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pageCount = (doc as any).internal.getNumberOfPages();
  const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

  doc.setFillColor(...SLATE_LIGHT);
  doc.rect(0, H - 16, W, 16, 'F');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_MID);
  doc.text('Dokumen ini digenerate otomatis oleh Sistem Gudang Agro', 14, H - 8);
  doc.text(`Halaman ${currentPage} dari ${pageCount}  |  Dicetak: ${today()}`, W - 14, H - 8, { align: 'right' });

  doc.setFillColor(...GREEN_MID);
  doc.rect(0, H - 3, W, 3, 'F');
};

// ─── Draw Horizontal Bar Chart ────────────────────────────────────────────────
const drawBarChart = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  items: { name: string; value: number; percent: number }[],
) => {
  const barH = 7;
  const gap = 3;
  let curY = y;

  items.forEach((item, i) => {
    const color = BAR_COLORS[i % BAR_COLORS.length];

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_DARK);
    doc.text(item.name, x, curY);

    // Value text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_MID);
    doc.text(`${fmtKg(item.value)} (${item.percent}%)`, x + w, curY, { align: 'right' });

    curY += 3;

    // Background bar
    doc.setFillColor(...SLATE_LIGHT);
    doc.roundedRect(x, curY, w, barH, 1.5, 1.5, 'F');

    // Value bar
    const barW = Math.max((item.percent / 100) * w, 2);
    doc.setFillColor(...color);
    doc.roundedRect(x, curY, barW, barH, 1.5, 1.5, 'F');

    curY += barH + gap;
  });

  return curY;
};

// ─── Draw Donut/Pie Chart (QC) ────────────────────────────────────────────────
const drawDonutChart = (
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  passedPercent: number,
  failedPercent: number,
) => {
  const segments = 100;

  // Draw passed segment (green)
  const passedEnd = (passedPercent / 100) * 2 * Math.PI - Math.PI / 2;
  const startAngle = -Math.PI / 2;

  // Full background circle
  doc.setFillColor(...SLATE_LIGHT);
  doc.circle(cx, cy, r, 'F');

  // Draw passed arc
  if (passedPercent > 0) {
    doc.setFillColor(...GREEN_MID);
    const points: [number, number][] = [[cx, cy]];
    for (let i = 0; i <= segments * (passedPercent / 100); i++) {
      const angle = startAngle + (i / segments) * 2 * Math.PI;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    // Draw as filled polygon using lines
    doc.setFillColor(...GREEN_MID);
    const path = points.map((p, idx) => (idx === 0 ? `${p[0]} ${p[1]} m` : `${p[0]} ${p[1]} l`)).join(' ');
    // Use triangle fan approach instead
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        cx, cy,
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        'F'
      );
    }
  }

  // Draw failed arc (red)
  if (failedPercent > 0) {
    const failStart = startAngle + (passedPercent / 100) * 2 * Math.PI;
    const failPoints: [number, number][] = [];
    for (let i = 0; i <= segments * (failedPercent / 100); i++) {
      const angle = failStart + (i / (segments * (failedPercent / 100))) * (failedPercent / 100) * 2 * Math.PI;
      failPoints.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    doc.setFillColor(...RED_MID);
    for (let i = 0; i < failPoints.length - 1; i++) {
      doc.triangle(
        cx, cy,
        failPoints[i][0], failPoints[i][1],
        failPoints[i + 1][0], failPoints[i + 1][1],
        'F'
      );
    }
  }

  // Inner circle (donut hole)
  const innerR = r * 0.55;
  doc.setFillColor(...WHITE);
  doc.circle(cx, cy, innerR, 'F');

  // Center text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_DARK);
  doc.text(`${passedPercent}%`, cx, cy + 1, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...SLATE_MID);
  doc.text('Lolos QC', cx, cy + 5, { align: 'center' });
};

// ─── Draw Trend Line Chart ────────────────────────────────────────────────────
const drawTrendChart = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { label: string; value: number }[],
) => {
  if (data.length === 0) return y + h;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padding = 4;
  const chartW = w - padding * 2;
  const chartH = h - padding * 2 - 8;
  const chartX = x + padding;
  const chartY = y + padding;

  // Background
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');

  // Grid lines
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = chartY + chartH - (i / 4) * chartH;
    doc.line(chartX, gy, chartX + chartW, gy);
  }

  if (data.length === 1) {
    // Single point
    const px = chartX + chartW / 2;
    const py = chartY + chartH - (data[0].value / maxVal) * chartH;
    doc.setFillColor(...GREEN_MID);
    doc.circle(px, py, 1.5, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...SLATE_MID);
    doc.text(data[0].label, px, chartY + chartH + 6, { align: 'center' });
    return y + h;
  }

  // Draw line segments
  const step = chartW / (data.length - 1);
  const points: [number, number][] = data.map((d, i) => [
    chartX + i * step,
    chartY + chartH - (d.value / maxVal) * chartH,
  ]);

  // Area fill
  doc.setFillColor(209, 250, 229);
  // Build area path using triangles
  for (let i = 0; i < points.length - 1; i++) {
    // top-left triangle
    doc.triangle(
      points[i][0], points[i][1],
      points[i + 1][0], points[i + 1][1],
      points[i][0], chartY + chartH,
      'F'
    );
    // bottom-right triangle
    doc.triangle(
      points[i + 1][0], points[i + 1][1],
      points[i + 1][0], chartY + chartH,
      points[i][0], chartY + chartH,
      'F'
    );
  }

  // Draw line
  doc.setDrawColor(...GREEN_MID);
  doc.setLineWidth(0.6);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }

  // Draw points
  points.forEach(([px, py]) => {
    doc.setFillColor(...WHITE);
    doc.circle(px, py, 1.8, 'F');
    doc.setFillColor(...GREEN_MID);
    doc.circle(px, py, 1.2, 'F');
  });

  // X-axis labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...SLATE_MID);
  data.forEach((d, i) => {
    const px = chartX + i * step;
    doc.text(d.label, px, chartY + chartH + 6, { align: 'center' });
  });

  return y + h;
};

// ─── Main Export ──────────────────────────────────────────────────────────────
export const generateLaporanPengadaanPDF = (
  permintaanList: PermintaanItem[],
  periodInfo?: { startDate?: string; endDate?: string }
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  let subtitle = 'Laporan Analisis Komoditas & QC';
  if (periodInfo?.startDate || periodInfo?.endDate) {
    const startStr = periodInfo.startDate ? fmtDate(periodInfo.startDate) : 'Awal';
    const endStr = periodInfo.endDate ? fmtDate(periodInfo.endDate) : 'Sekarang';
    subtitle = `Periode: ${startStr} s/d ${endStr}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Summary & Visualizations
  // ══════════════════════════════════════════════════════════════════════════

  drawHeader(doc, 'LAPORAN PENGADAAN', subtitle);

  let curY = 40;

  // ── Summary metrics ──
  const totalOrders = permintaanList.length;
  const totalWeight = permintaanList.reduce((s, p) => s + (Number(p.targetKg) || 0), 0);
  const completedOrders = permintaanList.filter(p => p.status === 'SELESAI_QC' || p.qcDetail).length;

  const commodityGroups: Record<string, number> = {};
  let totalQcChecked = 0;
  let totalQcFailed = 0;

  permintaanList.forEach(p => {
    const name = p.komoditasNama || 'Lainnya';
    const target = Number(p.targetKg) || 0;
    commodityGroups[name] = (commodityGroups[name] || 0) + target;
    if (p.qcDetail) {
      totalQcChecked += Number(p.qcDetail.beratAktual) || 0;
      totalQcFailed += Number(p.qcDetail.beratTidakLolos) || 0;
    }
  });

  const sortedCommodities = Object.entries(commodityGroups)
    .map(([name, weight]) => ({
      name,
      value: weight,
      percent: totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const qcPassedPercent = totalQcChecked > 0 ? Math.round(((totalQcChecked - totalQcFailed) / totalQcChecked) * 100) : 100;
  const qcFailedPercent = 100 - qcPassedPercent;

  // ── Info block ──
  doc.setFillColor(...SLATE_LIGHT);
  doc.roundedRect(14, curY, W - 28, 24, 2, 2, 'F');

  const metricBoxW = (W - 28 - 12) / 4;
  const metrics = [
    { label: 'TOTAL PERMINTAAN', value: `${totalOrders} pesanan` },
    { label: 'TOTAL VOLUME', value: fmtKg(totalWeight) },
    { label: 'SELESAI QC', value: `${completedOrders} pesanan` },
    { label: 'KELULUSAN QC', value: `${qcPassedPercent}%` },
  ];

  metrics.forEach((m, i) => {
    const mx = 17 + i * (metricBoxW + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...SLATE_MID);
    doc.text(m.label, mx, curY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...SLATE_DARK);
    doc.text(m.value, mx, curY + 17);
  });

  curY += 30;

  // ── Section: Perbandingan Komoditas ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Perbandingan Volume per Komoditas', 14, curY);
  curY += 5;

  const barChartW = W / 2 - 22;
  const barEndY = drawBarChart(doc, 14, curY, barChartW, sortedCommodities);

  // ── Section: Donut Chart QC ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Kelulusan Quality Control', W / 2 + 8, curY - 5);

  const donutCx = W / 2 + 8 + barChartW / 2;
  const donutCy = curY + 18;
  const donutR = 15;
  drawDonutChart(doc, donutCx, donutCy, donutR, qcPassedPercent, qcFailedPercent);

  // Legend
  const legendY = donutCy + donutR + 6;
  doc.setFillColor(...GREEN_MID);
  doc.roundedRect(W / 2 + 14, legendY, 4, 4, 0.5, 0.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_DARK);
  doc.text(`Lolos QC: ${qcPassedPercent}%`, W / 2 + 20, legendY + 3);

  doc.setFillColor(...RED_MID);
  doc.roundedRect(W / 2 + 14, legendY + 7, 4, 4, 0.5, 0.5, 'F');
  doc.setTextColor(...SLATE_DARK);
  doc.text(`Tidak Lolos: ${qcFailedPercent}%`, W / 2 + 20, legendY + 10);

  if (totalQcFailed > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...RED_MID);
    doc.text(`${fmtKg(totalQcFailed)} ditolak dari ${fmtKg(totalQcChecked)} yang di-QC`, W / 2 + 14, legendY + 18);
  }

  curY = Math.max(barEndY, legendY + 24) + 4;

  // ── Section: Tren Pesanan per Periode ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Tren Volume Pesanan per Bulan', 14, curY);
  curY += 4;

  // Aggregate by month
  const monthGroups: Record<string, number> = {};
  permintaanList.forEach(p => {
    const d = new Date(p.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthGroups[key] = (monthGroups[key] || 0) + (p.targetKg || 0);
  });
  const trendData = Object.entries(monthGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [y, m] = key.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return { label: `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`, value };
    });

  drawTrendChart(doc, 14, curY, W - 28, 45, trendData);
  curY += 50;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2+ — Detail Table
  // ══════════════════════════════════════════════════════════════════════════

  doc.addPage();
  drawHeader(doc, 'DETAIL PESANAN', 'Data Lengkap Permintaan Pengadaan');

  // Filter only items that have QC detail for meaningful table rows
  const tableData = permintaanList.map(p => {
    const qc = p.qcDetail;
    const tanggalSelesai = qc?.tanggal ? fmtDate(qc.tanggal) : '-';
    const tanggalExpired = (p.tanggalTiba || qc?.tanggal)
      ? fmtDate(new Date(new Date(p.tanggalTiba || qc?.tanggal).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString())
      : '-';
    const rencanaKemasan = p.rencanaProduksi
      ? ((p.rencanaProduksi as any).kemasan === 'kombinasi'
        ? `Kombinasi`
        : `${(p.rencanaProduksi as any).kemasan || '-'} kg`)
      : '-';
    const beratAktual = qc?.beratAktual !== undefined ? `${qc.beratAktual} kg` : '-';
    const beratLolosQC = qc?.beratAktual !== undefined
      ? `${(qc.beratAktual - (qc.beratTidakLolos || 0)).toFixed(1)} kg`
      : '-';
    const hasFoto = qc?.fotoQc ? 'Ya' : '-';

    return [
      p.nomorOrder || `#${p.id.substring(0, 8)}`,
      p.komoditasNama,
      tanggalSelesai,
      tanggalExpired,
      `${p.targetKg} kg`,
      rencanaKemasan,
      beratAktual,
      beratLolosQC,
      hasFoto,
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [[
      'No Order',
      'Komoditas',
      'Tgl Selesai',
      'Tgl Expired',
      'Target (kg)',
      'Kemasan',
      'Berat Aktual',
      'Lolos QC',
      'Foto',
    ]],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 12, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3+ — QC Photos (if any)
  // ══════════════════════════════════════════════════════════════════════════

  const photosItems = permintaanList.filter(p => p.qcDetail?.fotoQc);

  if (photosItems.length > 0) {
    doc.addPage();
    drawHeader(doc, 'BUKTI FOTO QC', `${photosItems.length} Foto Terlampir`);

    let photoY = 42;
    const photoMaxW = (W - 28 - 8) / 2;
    const photoMaxH = 55;
    let col = 0;

    photosItems.forEach((item, idx) => {
      try {
        const imgData = item.qcDetail.fotoQc;
        const xPos = 14 + col * (photoMaxW + 8);

        // Photo border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(xPos, photoY, photoMaxW, photoMaxH + 14, 2, 2);

        // Try to add image
        try {
          doc.addImage(imgData, 'JPEG', xPos + 2, photoY + 2, photoMaxW - 4, photoMaxH - 4, undefined, 'FAST');
        } catch {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...SLATE_MID);
          doc.text('Foto tidak dapat ditampilkan', xPos + photoMaxW / 2, photoY + photoMaxH / 2, { align: 'center' });
        }

        // Caption
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...SLATE_DARK);
        doc.text(
          `${item.nomorOrder || '#' + item.id.substring(0, 8)} — ${item.komoditasNama}`,
          xPos + 3,
          photoY + photoMaxH + 4,
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...SLATE_MID);
        doc.text(
          `Berat Aktual: ${item.qcDetail.beratAktual || '-'} kg | Lolos: ${((item.qcDetail.beratAktual || 0) - (item.qcDetail.beratTidakLolos || 0)).toFixed(1)} kg`,
          xPos + 3,
          photoY + photoMaxH + 9,
        );

        col++;
        if (col >= 2) {
          col = 0;
          photoY += photoMaxH + 20;

          // Check if we need a new page
          if (photoY + photoMaxH + 20 > H - 20 && idx < photosItems.length - 1) {
            doc.addPage();
            drawHeader(doc, 'BUKTI FOTO QC', 'Lanjutan');
            photoY = 42;
          }
        }
      } catch {
        // Skip if image fails
      }
    });
  }

  // ── Add footer to all pages ──
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc);
  }

  // ── Save ──
  doc.save(`Laporan-Pengadaan-${new Date().toISOString().slice(0, 10)}.pdf`);
};
