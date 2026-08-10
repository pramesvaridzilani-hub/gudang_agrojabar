import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
const INDIGO_MID  = [99, 102, 241]  as [number, number, number];
const AMBER_MID   = [245, 158, 11]  as [number, number, number];
const PINK_MID    = [236, 72, 153]  as [number, number, number];

const BAR_COLORS: [number, number, number][] = [
  GREEN_MID, BLUE_MID, INDIGO_MID, AMBER_MID, PINK_MID,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const today = () =>
  new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtKg = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)} ton` : `${n.toFixed(1)} kg`;

const getBestBefore = (iso: string) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 9);
  return fmtDate(d.toISOString());
};

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

// ─── Draw bar chart ───────────────────────────────────────────────────────────
const drawBarChart = (
  doc: jsPDF, x: number, y: number, w: number,
  items: { name: string; value: number; percent: number }[],
) => {
  const barH = 7;
  const gap = 3;
  let curY = y;
  items.forEach((item, i) => {
    const color = BAR_COLORS[i % BAR_COLORS.length];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_DARK);
    doc.text(item.name, x, curY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_MID);
    doc.text(`${fmtKg(item.value)} (${item.percent}%)`, x + w, curY, { align: 'right' });
    curY += 3;
    doc.setFillColor(...SLATE_LIGHT);
    doc.roundedRect(x, curY, w, barH, 1.5, 1.5, 'F');
    const barW = Math.max((item.percent / 100) * w, 2);
    doc.setFillColor(...color);
    doc.roundedRect(x, curY, barW, barH, 1.5, 1.5, 'F');
    curY += barH + gap;
  });
  return curY;
};

// ─── Draw donut chart ─────────────────────────────────────────────────────────
const drawDonutChart = (
  doc: jsPDF, cx: number, cy: number, r: number,
  passedPct: number, failedPct: number,
) => {
  doc.setFillColor(...SLATE_LIGHT);
  doc.circle(cx, cy, r, 'F');
  const segments = 100;
  const startAngle = -Math.PI / 2;
  if (passedPct > 0) {
    const points: [number, number][] = [];
    for (let i = 0; i <= segments * (passedPct / 100); i++) {
      const angle = startAngle + (i / segments) * 2 * Math.PI;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    doc.setFillColor(...GREEN_MID);
    for (let i = 0; i < points.length - 1; i++) {
      doc.triangle(cx, cy, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], 'F');
    }
  }
  if (failedPct > 0) {
    const failStart = startAngle + (passedPct / 100) * 2 * Math.PI;
    const failPoints: [number, number][] = [];
    for (let i = 0; i <= segments * (failedPct / 100); i++) {
      const angle = failStart + (i / (segments * (failedPct / 100))) * (failedPct / 100) * 2 * Math.PI;
      failPoints.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    doc.setFillColor(...RED_MID);
    for (let i = 0; i < failPoints.length - 1; i++) {
      doc.triangle(cx, cy, failPoints[i][0], failPoints[i][1], failPoints[i + 1][0], failPoints[i + 1][1], 'F');
    }
  }
  doc.setFillColor(...WHITE);
  doc.circle(cx, cy, r * 0.55, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_DARK);
  doc.text(`${passedPct}%`, cx, cy + 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...SLATE_MID);
  doc.text('Lolos QC', cx, cy + 5, { align: 'center' });
};

// ─── Draw trend line ──────────────────────────────────────────────────────────
const drawTrendChart = (
  doc: jsPDF, x: number, y: number, w: number, h: number,
  data: { label: string; value: number }[],
) => {
  if (data.length === 0) return y + h;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const pad = 4;
  const cW = w - pad * 2;
  const cH = h - pad * 2 - 8;
  const cX = x + pad;
  const cY = y + pad;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i++) {
    const gy = cY + cH - (i / 4) * cH;
    doc.line(cX, gy, cX + cW, gy);
  }

  if (data.length === 1) {
    const px = cX + cW / 2;
    const py = cY + cH - (data[0].value / maxVal) * cH;
    doc.setFillColor(...GREEN_MID);
    doc.circle(px, py, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...SLATE_MID);
    doc.text(data[0].label, px, cY + cH + 6, { align: 'center' });
    return y + h;
  }

  const step = cW / (data.length - 1);
  const points: [number, number][] = data.map((d, i) => [
    cX + i * step, cY + cH - (d.value / maxVal) * cH,
  ]);

  doc.setFillColor(209, 250, 229);
  for (let i = 0; i < points.length - 1; i++) {
    doc.triangle(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], points[i][0], cY + cH, 'F');
    doc.triangle(points[i + 1][0], points[i + 1][1], points[i + 1][0], cY + cH, points[i][0], cY + cH, 'F');
  }
  doc.setDrawColor(...GREEN_MID);
  doc.setLineWidth(0.6);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
  points.forEach(([px, py]) => {
    doc.setFillColor(...WHITE);
    doc.circle(px, py, 1.8, 'F');
    doc.setFillColor(...GREEN_MID);
    doc.circle(px, py, 1.2, 'F');
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...SLATE_MID);
  data.forEach((d, i) => {
    doc.text(d.label, cX + i * step, cY + cH + 6, { align: 'center' });
  });
  return y + h;
};

// ─── Main Export ──────────────────────────────────────────────────────────────
export const generateLaporanHistoryPDF = (
  items: any[],
  periodInfo?: { startDate?: string; endDate?: string }
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  let subtitle = 'Riwayat & HPP Produksi';
  if (periodInfo?.startDate || periodInfo?.endDate) {
    const startStr = periodInfo.startDate ? fmtDate(periodInfo.startDate) : 'Awal';
    const endStr = periodInfo.endDate ? fmtDate(periodInfo.endDate) : 'Sekarang';
    subtitle = `Periode: ${startStr} s/d ${endStr}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Summary & Visualizations
  // ══════════════════════════════════════════════════════════════════════════
  drawHeader(doc, 'LAPORAN PRODUKSI', subtitle);

  let curY = 40;

  // Aggregate stats
  const completedItems = items.filter(i => i.statusJadwal === 'SELESAI');
  const cancelledItems = items.filter(i => i.statusJadwal === 'BATAL');
  const totalVolume = items.reduce((s: number, i: any) => s + (Number(i.volumeTotalKg) || 0), 0);

  // Commodity breakdown
  const commodityMap: Record<string, { target: number; actual: number; passed: number; rejected: number }> = {};
  let totalTarget = 0;
  let totalActual = 0;
  let totalPassed = 0;
  let totalRejected = 0;
  let totalHppCost = 0;

  // Worker stats
  let totalWorkerPay = 0;
  let workerCount = 0;

  items.forEach((item: any) => {
    const laps = item.laporanEksekusi || [];
    laps.forEach((lap: any) => {
      const name = lap.nama || 'Lainnya';
      if (!commodityMap[name]) commodityMap[name] = { target: 0, actual: 0, passed: 0, rejected: 0 };
      const tgt = Number(lap.targetVolumeKg) || 0;
      const act = Number(lap.hasilPenimbanganAkhir) || 0;
      commodityMap[name].target += tgt;
      commodityMap[name].actual += act;
      totalTarget += tgt;
      totalActual += act;

      if (lap.lolosSop) {
        commodityMap[name].passed += act;
        totalPassed += act;
      } else {
        commodityMap[name].rejected += act;
        totalRejected += act;
      }

      if (lap.hppDetail) {
        totalHppCost += Number(lap.hppDetail.totalBiaya) || 0;
      }
    });

    // Worker data
    if (item.hariProduksi) {
      item.hariProduksi.forEach((hp: any) => {
        (hp.tenagaKerja || []).forEach((tk: any) => {
          totalWorkerPay += Number(tk.totalUpah) || 0;
          workerCount++;
        });
      });
    }
  });

  const sortedCommodities = Object.entries(commodityMap)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.target - a.target);

  const qcPassedPct = totalActual > 0 ? Math.round((totalPassed / totalActual) * 100) : 100;
  const qcFailedPct = 100 - qcPassedPct;

  // ── Metric boxes ──
  doc.setFillColor(...SLATE_LIGHT);
  doc.roundedRect(14, curY, W - 28, 28, 2, 2, 'F');

  const metricBoxW = (W - 28 - 20) / 5;
  const metrics = [
    { label: 'TOTAL JADWAL', value: `${items.length}` },
    { label: 'SELESAI', value: `${completedItems.length}` },
    { label: 'BATAL', value: `${cancelledItems.length}` },
    { label: 'TOTAL VOLUME', value: fmtKg(totalVolume) },
    { label: 'TOTAL HPP', value: fmtRp(totalHppCost) },
  ];

  metrics.forEach((m, i) => {
    const mx = 17 + i * (metricBoxW + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...SLATE_MID);
    doc.text(m.label, mx, curY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_DARK);
    doc.text(m.value, mx, curY + 17);
  });

  curY += 34;

  // ── Charts row ──
  const chartColW = (W - 28 - 10) / 2;

  // Left: Commodity bar chart
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Perbandingan Volume per Komoditas', 14, curY);
  curY += 5;

  const barItems = sortedCommodities.map(c => ({
    name: c.name,
    value: c.target,
    percent: totalTarget > 0 ? Math.round((c.target / totalTarget) * 100) : 0,
  }));
  const barEndY = drawBarChart(doc, 14, curY, chartColW, barItems);

  // Right: Donut chart
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Kelulusan QC Produksi', W / 2 + 8, curY - 5);

  const donutCx = W / 2 + 8 + chartColW / 2;
  const donutCy = curY + 18;
  drawDonutChart(doc, donutCx, donutCy, 15, qcPassedPct, qcFailedPct);

  // Legend
  const legendY = donutCy + 22;
  doc.setFillColor(...GREEN_MID);
  doc.roundedRect(W / 2 + 14, legendY, 4, 4, 0.5, 0.5, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_DARK);
  doc.text(`Lolos QC: ${qcPassedPct}% (${fmtKg(totalPassed)})`, W / 2 + 20, legendY + 3);

  doc.setFillColor(...RED_MID);
  doc.roundedRect(W / 2 + 14, legendY + 7, 4, 4, 0.5, 0.5, 'F');
  doc.text(`Tidak Lolos: ${qcFailedPct}% (${fmtKg(totalRejected)})`, W / 2 + 20, legendY + 10);

  // Worker summary
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE_MID);
  doc.text(`Total ${workerCount} pencatatan pekerja | Biaya borongan: ${fmtRp(totalWorkerPay)}`, W / 2 + 14, legendY + 19);

  curY = Math.max(barEndY, legendY + 26) + 4;

  // ── Trend line ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN_DARK);
  doc.text('Tren Volume Produksi per Bulan', 14, curY);
  curY += 4;

  const monthGroups: Record<string, number> = {};
  items.forEach((item: any) => {
    const d = new Date(item.updatedAt || item.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthGroups[key] = (monthGroups[key] || 0) + (item.volumeTotalKg || 0);
  });
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const trendData = Object.entries(monthGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [y, m] = key.split('-');
      return { label: `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`, value };
    });

  drawTrendChart(doc, 14, curY, W - 28, 45, trendData);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2+ — Detail Table
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader(doc, 'DETAIL PRODUKSI', 'Laporan Eksekusi & HPP per Komoditas');

  const tableRows: any[] = [];
  items.forEach((item: any) => {
    const tglSelesai = item.updatedAt || item.createdAt;
    const laps = item.laporanEksekusi || [];

    if (laps.length === 0) {
      tableRows.push([
        item.komoditasNama,
        item.statusJadwal === 'SELESAI' ? 'Selesai' : 'Batal',
        fmtDate(tglSelesai),
        getBestBefore(tglSelesai),
        `${item.volumeTotalKg} kg`,
        '-',
        '-',
        '-',
        '-',
        '-',
      ]);
    } else {
      laps.forEach((lap: any) => {
        const hpp = lap.hppDetail;
        tableRows.push([
          lap.nama || item.komoditasNama,
          lap.lolosSop ? 'Lolos' : 'Reject',
          fmtDate(tglSelesai),
          getBestBefore(tglSelesai),
          `${lap.targetVolumeKg || 0} kg`,
          `${lap.hasilPenimbanganAkhir || 0} kg`,
          lap.catatanQc || '-',
          hpp ? fmtRp(hpp.totalBiaya || 0) : '-',
          hpp ? fmtRp(hpp.hppPerKg || 0) : '-',
          lap.fotoBukti ? 'Ya' : '-',
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: 40,
    head: [[
      'Komoditas',
      'Status QC',
      'Tgl Selesai',
      'Best Before',
      'Target (kg)',
      'Hasil Akhir',
      'Catatan QC',
      'Total HPP',
      'HPP/kg',
      'Foto',
    ]],
    body: tableRows,
    styles: {
      fontSize: 6.5,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 14 },
      2: { cellWidth: 19 },
      3: { cellWidth: 19 },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 17, halign: 'right' },
      6: { cellWidth: 26 },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 10, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3+ — Photos
  // ══════════════════════════════════════════════════════════════════════════
  const photoEntries: { name: string; foto: string; target: number; actual: number }[] = [];
  items.forEach((item: any) => {
    (item.laporanEksekusi || []).forEach((lap: any) => {
      if (lap.fotoBukti) {
        photoEntries.push({
          name: lap.nama || item.komoditasNama,
          foto: lap.fotoBukti,
          target: lap.targetVolumeKg || 0,
          actual: lap.hasilPenimbanganAkhir || 0,
        });
      }
    });
  });

  if (photoEntries.length > 0) {
    doc.addPage();
    drawHeader(doc, 'BUKTI FOTO PRODUKSI', `${photoEntries.length} Foto Terlampir`);

    let photoY = 42;
    const photoMaxW = (W - 28 - 8) / 2;
    const photoMaxH = 55;
    let col = 0;

    photoEntries.forEach((entry, idx) => {
      try {
        const xPos = 14 + col * (photoMaxW + 8);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(xPos, photoY, photoMaxW, photoMaxH + 14, 2, 2);

        try {
          doc.addImage(entry.foto, 'JPEG', xPos + 2, photoY + 2, photoMaxW - 4, photoMaxH - 4, undefined, 'FAST');
        } catch {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...SLATE_MID);
          doc.text('Foto tidak dapat ditampilkan', xPos + photoMaxW / 2, photoY + photoMaxH / 2, { align: 'center' });
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...SLATE_DARK);
        doc.text(entry.name, xPos + 3, photoY + photoMaxH + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...SLATE_MID);
        doc.text(`Target: ${entry.target} kg | Hasil: ${entry.actual} kg`, xPos + 3, photoY + photoMaxH + 9);

        col++;
        if (col >= 2) {
          col = 0;
          photoY += photoMaxH + 20;
          if (photoY + photoMaxH + 20 > H - 20 && idx < photoEntries.length - 1) {
            doc.addPage();
            drawHeader(doc, 'BUKTI FOTO PRODUKSI', 'Lanjutan');
            photoY = 42;
          }
        }
      } catch {
        // Skip failed photos
      }
    });
  }

  // ── Footers ──
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc);
  }

  doc.save(`Laporan-Produksi-${new Date().toISOString().slice(0, 10)}.pdf`);
};
