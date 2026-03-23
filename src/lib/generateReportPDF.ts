import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MonthRow {
  mes: number;
  ingresos: number;
  egresos: number;
  resultado: number;
  margen: number;
}

interface CategoryRow {
  categoria: string;
  total: number;
  pct: number;
}

interface AlertRow {
  level: "critical" | "warning" | "info";
  title: string;
  description: string;
}

interface ReportData {
  anio: string;
  empresa: string;
  rows: MonthRow[];
  prevRows: MonthRow[];
  categories: CategoryRow[];
  alerts: AlertRow[];
  totals: { ingresos: number; egresos: number; resultado: number; margen: number };
  prevTotals: { ingresos: number; egresos: number; resultado: number; margen: number };
}

const MESES_FULL = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function fmt(n: number): string {
  return "$" + Math.abs(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pctChange(curr: number, prev: number): number | null {
  return prev > 0 ? ((curr - prev) / prev) * 100 : null;
}

export function generateReportPDF(data: ReportData) {
  const { anio, empresa, rows, prevRows, categories, alerts, totals, prevTotals } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Colors ──
  const jade = [34, 197, 94] as [number, number, number];
  const red = [239, 68, 68] as [number, number, number];
  const yellow = [234, 179, 8] as [number, number, number];
  const dark = [10, 10, 10] as [number, number, number];
  const darkSurface = [20, 20, 20] as [number, number, number];
  const textWhite = [255, 255, 255] as [number, number, number];
  const textGray = [136, 136, 136] as [number, number, number];
  const textLight = [229, 229, 229] as [number, number, number];

  // ── Background ──
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  // ── Helper: new page with bg ──
  function newPage() {
    doc.addPage();
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
    y = margin;
  }

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      newPage();
    }
  }

  // ── Header ──
  doc.setFillColor(...darkSurface);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, "F");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textWhite);
  doc.text("Estado de Resultados", margin + 6, y + 9);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textGray);
  doc.text(`${empresa === "TODAS" ? "Consolidado" : empresa} — ${anio}`, margin + 6, y + 17);
  
  const dateStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  doc.setFontSize(8);
  doc.text(`Generado: ${dateStr}`, pageW - margin - 6, y + 17, { align: "right" });
  y += 28;

  // ── KPIs Section ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textWhite);
  doc.text("Indicadores Clave", margin, y);
  y += 6;

  const kpiW = (contentW - 9) / 4;
  const kpis = [
    { label: "Ingresos Totales", value: fmt(totals.ingresos), trend: pctChange(totals.ingresos, prevTotals.ingresos), color: jade },
    { label: "Egresos Totales", value: fmt(totals.egresos), trend: pctChange(totals.egresos, prevTotals.egresos), color: red },
    { label: "Resultado Neto", value: (totals.resultado >= 0 ? "+" : "-") + fmt(totals.resultado), trend: pctChange(totals.resultado, prevTotals.resultado), color: totals.resultado >= 0 ? jade : red },
    { label: "Margen Operativo", value: `${totals.margen.toFixed(1)}%`, trend: null, color: totals.margen >= 15 ? jade : totals.margen >= 0 ? yellow : red },
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 3);
    doc.setFillColor(...darkSurface);
    doc.roundedRect(x, y, kpiW, 22, 2, 2, "F");
    
    // Accent bar
    doc.setFillColor(...kpi.color);
    doc.rect(x, y, 2, 22, "F");
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textGray);
    doc.text(kpi.label.toUpperCase(), x + 5, y + 6);
    
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textWhite);
    doc.text(kpi.value, x + 5, y + 14);
    
    if (kpi.trend !== null) {
      const trendStr = `${kpi.trend >= 0 ? "▲" : "▼"} ${Math.abs(kpi.trend).toFixed(1)}% vs ${Number(anio) - 1}`;
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...(kpi.trend >= 0 ? jade : red));
      doc.text(trendStr, x + 5, y + 19);
    }
  });
  y += 28;

  // ── Alerts Section ──
  if (alerts.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textWhite);
    doc.text("Alertas Estratégicas", margin, y);
    y += 5;

    alerts.forEach((alert) => {
      checkPage(14);
      const aColor = alert.level === "critical" ? red : alert.level === "warning" ? yellow : jade;
      doc.setFillColor(aColor[0], aColor[1], aColor[2]);
      doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
      doc.roundedRect(margin, y, contentW, 11, 2, 2, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      
      // Accent dot
      doc.setFillColor(...aColor);
      doc.circle(margin + 5, y + 5.5, 1.5, "F");
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...aColor);
      doc.text(alert.title, margin + 10, y + 4.5);
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...textLight);
      doc.text(alert.description, margin + 10, y + 9, { maxWidth: contentW - 15 });
      y += 13;
    });
    y += 3;
  }

  // ── Monthly P&L Table ──
  checkPage(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textWhite);
  doc.text("Desglose Mensual", margin, y);
  y += 3;

  const tableBody = rows.map((r, i) => {
    const prevR = prevRows[i];
    const hasData = r.ingresos > 0 || r.egresos > 0;
    const yoy = prevR && prevR.resultado !== 0
      ? `${((r.resultado - prevR.resultado) / Math.abs(prevR.resultado) * 100).toFixed(0)}%`
      : "—";
    const signal = !hasData ? "" : r.margen >= 15 ? "🟢" : r.margen >= 0 ? "🟡" : "🔴";
    return [
      MESES_FULL[r.mes - 1],
      hasData ? fmt(r.ingresos) : "—",
      hasData ? fmt(r.egresos) : "—",
      hasData ? `${r.resultado >= 0 ? "+" : "-"}${fmt(r.resultado)}` : "—",
      hasData ? `${r.margen.toFixed(1)}%` : "—",
      yoy,
      signal,
    ];
  });

  // Total row
  tableBody.push([
    `TOTAL ${anio}`,
    fmt(totals.ingresos),
    fmt(totals.egresos),
    `${totals.resultado >= 0 ? "+" : "-"}${fmt(totals.resultado)}`,
    `${totals.margen.toFixed(1)}%`,
    pctChange(totals.resultado, prevTotals.resultado) !== null
      ? `${pctChange(totals.resultado, prevTotals.resultado)!.toFixed(0)}%`
      : "—",
    "",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Mes", "Ingresos", "Egresos", "Resultado", "Margen", `vs ${Number(anio) - 1}`, ""]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: textLight,
      fillColor: dark,
      lineWidth: 0.1,
      lineColor: [26, 26, 26],
    },
    headStyles: {
      fillColor: darkSurface,
      textColor: textGray,
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: "bold" },
      1: { halign: "right", cellWidth: 28 },
      2: { halign: "right", cellWidth: 28 },
      3: { halign: "right", cellWidth: 30, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "center", cellWidth: 10 },
    },
    didParseCell: (hookData) => {
      const { row, column, cell } = hookData;
      if (row.section === "body") {
        // Color code resultado column
        if (column.index === 3) {
          const val = String(cell.raw);
          cell.styles.textColor = val.startsWith("+") ? jade : val.startsWith("-") ? red : textLight;
        }
        // Color code ingresos
        if (column.index === 1 && String(cell.raw) !== "—") {
          cell.styles.textColor = jade;
        }
        // Color code egresos
        if (column.index === 2 && String(cell.raw) !== "—") {
          cell.styles.textColor = red;
        }
        // Color margen
        if (column.index === 4 && String(cell.raw) !== "—") {
          const pct = parseFloat(String(cell.raw));
          cell.styles.textColor = pct >= 15 ? jade : pct >= 0 ? yellow : red;
        }
        // Bold total row
        if (row.index === tableBody.length - 1) {
          cell.styles.fillColor = darkSurface;
          cell.styles.fontStyle = "bold";
          cell.styles.fontSize = 8;
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Categories Breakdown ──
  if (categories.length > 0) {
    checkPage(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textWhite);
    doc.text("Distribución de Gastos por Categoría", margin, y);
    y += 3;

    const catBody = categories.map((c) => [
      c.categoria,
      fmt(c.total),
      `${c.pct.toFixed(1)}%`,
    ]);

    const totalCat = categories.reduce((s, c) => s + c.total, 0);
    catBody.push(["TOTAL", fmt(totalCat), "100%"]);

    autoTable(doc, {
      startY: y,
      head: [["Categoría", "Monto", "% del Total"]],
      body: catBody,
      theme: "plain",
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: textLight,
        fillColor: dark,
        lineWidth: 0.1,
        lineColor: [26, 26, 26],
      },
      headStyles: {
        fillColor: darkSurface,
        textColor: textGray,
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: "right", cellWidth: 35, textColor: red },
        2: { halign: "right", cellWidth: 25 },
      },
      didParseCell: (hookData) => {
        const { row, cell } = hookData;
        if (row.section === "body" && row.index === catBody.length - 1) {
          cell.styles.fillColor = darkSurface;
          cell.styles.fontStyle = "bold";
          cell.styles.fontSize = 8;
        }
        // Highlight top category bar
        if (row.section === "body" && row.index === 0 && hookData.column.index === 0) {
          cell.styles.textColor = yellow;
        }
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── YoY Comparison Summary ──
  checkPage(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textWhite);
  doc.text(`Comparativo ${Number(anio) - 1} vs ${anio}`, margin, y);
  y += 3;

  const yoyBody = [
    [
      "Ingresos",
      fmt(prevTotals.ingresos),
      fmt(totals.ingresos),
      pctChange(totals.ingresos, prevTotals.ingresos) !== null
        ? `${pctChange(totals.ingresos, prevTotals.ingresos)! >= 0 ? "+" : ""}${pctChange(totals.ingresos, prevTotals.ingresos)!.toFixed(1)}%`
        : "N/A",
    ],
    [
      "Egresos",
      fmt(prevTotals.egresos),
      fmt(totals.egresos),
      pctChange(totals.egresos, prevTotals.egresos) !== null
        ? `${pctChange(totals.egresos, prevTotals.egresos)! >= 0 ? "+" : ""}${pctChange(totals.egresos, prevTotals.egresos)!.toFixed(1)}%`
        : "N/A",
    ],
    [
      "Resultado Neto",
      `${prevTotals.resultado >= 0 ? "+" : "-"}${fmt(prevTotals.resultado)}`,
      `${totals.resultado >= 0 ? "+" : "-"}${fmt(totals.resultado)}`,
      pctChange(totals.resultado, prevTotals.resultado) !== null
        ? `${pctChange(totals.resultado, prevTotals.resultado)! >= 0 ? "+" : ""}${pctChange(totals.resultado, prevTotals.resultado)!.toFixed(1)}%`
        : "N/A",
    ],
    [
      "Margen",
      `${prevTotals.margen.toFixed(1)}%`,
      `${totals.margen.toFixed(1)}%`,
      `${(totals.margen - prevTotals.margen) >= 0 ? "+" : ""}${(totals.margen - prevTotals.margen).toFixed(1)}pp`,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Métrica", String(Number(anio) - 1), anio, "Variación"]],
    body: yoyBody,
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: textLight,
      fillColor: dark,
      lineWidth: 0.1,
      lineColor: [26, 26, 26],
    },
    headStyles: {
      fillColor: darkSurface,
      textColor: textGray,
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { halign: "right", cellWidth: 35 },
      2: { halign: "right", cellWidth: 35, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 30 },
    },
    didParseCell: (hookData) => {
      const { column, cell } = hookData;
      if (hookData.row.section === "body" && column.index === 3) {
        const val = String(cell.raw);
        cell.styles.textColor = val.startsWith("+") ? jade : val.startsWith("-") ? red : textLight;
        cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...textGray);
    doc.text(
      `Página ${p} de ${pageCount}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.text(
      "Reporte generado automáticamente — Confidencial",
      pageW / 2, doc.internal.pageSize.getHeight() - 4,
      { align: "center" }
    );
  }

  // ── Download ──
  doc.save(`Estado_Resultados_${anio}_${empresa}.pdf`);
}
