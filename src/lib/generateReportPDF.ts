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
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Theme ──
const C = {
  jade: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  yellow: [234, 179, 8] as [number, number, number],
  bg: [10, 10, 10] as [number, number, number],
  surface: [22, 22, 22] as [number, number, number],
  surfaceLight: [30, 30, 30] as [number, number, number],
  white: [245, 245, 245] as [number, number, number],
  gray: [140, 140, 140] as [number, number, number],
  lightGray: [200, 200, 200] as [number, number, number],
  border: [40, 40, 40] as [number, number, number],
};

function fmt(n: number): string {
  return "$" + Math.abs(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pctChange(curr: number, prev: number): number | null {
  return prev > 0 ? ((curr - prev) / prev) * 100 : null;
}

function colorForValue(val: number, thresholdPos = 0): [number, number, number] {
  return val >= thresholdPos ? C.jade : C.red;
}

export function generateReportPDF(data: ReportData) {
  const { anio, empresa, rows, prevRows, categories, alerts, totals, prevTotals } = data;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14; // margin
  const W = pageW - M * 2;
  let y = M;

  // ── Helpers ──
  function fillBg() {
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  function newPage() {
    doc.addPage();
    fillBg();
    y = M;
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageH - M - 12) {
      newPage();
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(14);
    doc.setFillColor(...C.surface);
    doc.roundedRect(M, y, W, 8, 1.5, 1.5, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.white);
    doc.text(title.toUpperCase(), M + 4, y + 5.5);
    y += 11;
  }

  // ── Page 1 Background ──
  fillBg();

  // ── Header ──
  doc.setFillColor(...C.surface);
  doc.roundedRect(M, y, W, 20, 2, 2, "F");
  // Left accent bar
  doc.setFillColor(...C.jade);
  doc.rect(M, y, 2.5, 20, "F");

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("Estado de Resultados", M + 7, y + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.gray);
  const subtitle = empresa === "TODAS" ? "Consolidado" : empresa;
  doc.text(`${subtitle}  •  Ejercicio ${anio}`, M + 7, y + 15);

  const dateStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  doc.setFontSize(7);
  doc.text(dateStr, pageW - M - 4, y + 15, { align: "right" });
  y += 25;

  // ── KPI Cards ──
  sectionTitle("Indicadores Clave");

  const kpiW = (W - 6) / 4;
  const kpiH = 24;
  const kpis = [
    { label: "Ingresos", value: fmt(totals.ingresos), trend: pctChange(totals.ingresos, prevTotals.ingresos), color: C.jade },
    { label: "Egresos", value: fmt(totals.egresos), trend: pctChange(totals.egresos, prevTotals.egresos), color: C.red },
    { label: "Resultado Neto", value: (totals.resultado >= 0 ? "+" : "-") + fmt(totals.resultado), trend: pctChange(totals.resultado, prevTotals.resultado), color: colorForValue(totals.resultado) },
    { label: "Margen", value: `${totals.margen.toFixed(1)}%`, trend: null, color: totals.margen >= 15 ? C.jade : totals.margen >= 0 ? C.yellow : C.red },
  ];

  kpis.forEach((kpi, i) => {
    const x = M + i * (kpiW + 2);
    doc.setFillColor(...C.surfaceLight);
    doc.roundedRect(x, y, kpiW, kpiH, 2, 2, "F");

    // Top accent line
    doc.setFillColor(...kpi.color);
    doc.rect(x + 4, y + 1, kpiW - 8, 0.8, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.gray);
    doc.text(kpi.label.toUpperCase(), x + 4, y + 7);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.white);
    doc.text(kpi.value, x + 4, y + 14.5);

    if (kpi.trend !== null) {
      const arrow = kpi.trend >= 0 ? "+" : "";
      const trendStr = `${arrow}${kpi.trend.toFixed(1)}% vs ${Number(anio) - 1}`;
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...(kpi.trend >= 0 ? C.jade : C.red));
      doc.text(trendStr, x + 4, y + 20);
    }
  });
  y += kpiH + 6;

  // ── Alerts ──
  if (alerts.length > 0) {
    sectionTitle("Alertas Estratégicas");

    alerts.forEach((alert) => {
      ensureSpace(12);
      const aColor = alert.level === "critical" ? C.red : alert.level === "warning" ? C.yellow : C.jade;

      doc.setFillColor(...C.surfaceLight);
      doc.roundedRect(M, y, W, 10, 1.5, 1.5, "F");

      // Left accent
      doc.setFillColor(...aColor);
      doc.rect(M, y, 2, 10, "F");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...aColor);
      doc.text(alert.title, M + 5, y + 4);

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.lightGray);
      doc.text(alert.description, M + 5, y + 8.5, { maxWidth: W - 10 });
      y += 12;
    });
    y += 2;
  }

  // ── Monthly P&L Table ──
  sectionTitle(`Desglose Mensual — ${anio}`);

  const tableBody = rows.map((r, i) => {
    const prevR = prevRows[i];
    const hasData = r.ingresos > 0 || r.egresos > 0;
    const yoy = prevR && prevR.resultado !== 0
      ? `${((r.resultado - prevR.resultado) / Math.abs(prevR.resultado) * 100).toFixed(0)}%`
      : "—";
    return [
      MESES_FULL[r.mes - 1],
      hasData ? fmt(r.ingresos) : "—",
      hasData ? fmt(r.egresos) : "—",
      hasData ? `${r.resultado >= 0 ? "+" : "-"}${fmt(r.resultado)}` : "—",
      hasData ? `${r.margen.toFixed(1)}%` : "—",
      yoy,
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
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Mes", "Ingresos", "Egresos", "Resultado", "Margen", `vs ${Number(anio) - 1}`]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      textColor: C.lightGray,
      fillColor: C.bg,
      lineWidth: 0.2,
      lineColor: C.border,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: C.surface,
      textColor: C.gray,
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { halign: "right", cellWidth: 30 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 24 },
    },
    didDrawPage: () => {
      // Repaint bg on new pages created by autoTable
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pageW, pageH, "FD");
    },
    willDrawPage: () => {
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pageW, pageH, "F");
    },
    didParseCell: (hookData) => {
      const { row, column, cell } = hookData;
      if (row.section === "body") {
        if (column.index === 1 && String(cell.raw) !== "—") {
          cell.styles.textColor = C.jade;
        }
        if (column.index === 2 && String(cell.raw) !== "—") {
          cell.styles.textColor = C.red;
        }
        if (column.index === 3) {
          const val = String(cell.raw);
          cell.styles.textColor = val.startsWith("+") ? C.jade : val.startsWith("-") ? C.red : C.lightGray;
        }
        if (column.index === 4 && String(cell.raw) !== "—") {
          const pct = parseFloat(String(cell.raw));
          cell.styles.textColor = pct >= 15 ? C.jade : pct >= 0 ? C.yellow : C.red;
        }
        if (column.index === 5 && String(cell.raw) !== "—") {
          const val = String(cell.raw);
          const num = parseFloat(val);
          if (!isNaN(num)) {
            cell.styles.textColor = num >= 0 ? C.jade : C.red;
          }
        }
        // Bold total row
        if (row.index === tableBody.length - 1) {
          cell.styles.fillColor = C.surface;
          cell.styles.fontStyle = "bold";
          cell.styles.fontSize = 8;
          cell.styles.textColor = C.white;
          // Keep color coding for specific columns
          if (column.index === 1) cell.styles.textColor = C.jade;
          if (column.index === 2) cell.styles.textColor = C.red;
          if (column.index === 3) cell.styles.textColor = colorForValue(totals.resultado);
          if (column.index === 4) cell.styles.textColor = totals.margen >= 0 ? C.jade : C.red;
        }
      }
    },
    margin: { left: M, right: M, top: M, bottom: M + 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Categories Breakdown ──
  if (categories.length > 0) {
    sectionTitle("Distribución de Gastos por Categoría");

    const catBody = categories.map((c, i) => [
      `${i + 1}.`,
      c.categoria,
      fmt(c.total),
      `${c.pct.toFixed(1)}%`,
    ]);

    const totalCat = categories.reduce((s, c) => s + c.total, 0);
    catBody.push(["", "TOTAL", fmt(totalCat), "100%"]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Categoría", "Monto", "% del Total"]],
      body: catBody,
      theme: "plain",
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        textColor: C.lightGray,
        fillColor: C.bg,
        lineWidth: 0.2,
        lineColor: C.border,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: C.surface,
        textColor: C.gray,
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", textColor: C.gray },
        1: { cellWidth: 65 },
        2: { halign: "right", cellWidth: 35, textColor: C.red },
        3: { halign: "right", cellWidth: 28 },
      },
      willDrawPage: () => {
        doc.setFillColor(...C.bg);
        doc.rect(0, 0, pageW, pageH, "F");
      },
      didParseCell: (hookData) => {
        const { row, cell, column } = hookData;
        if (row.section === "body") {
          // Highlight top category
          if (row.index === 0 && column.index === 1) {
            cell.styles.textColor = C.yellow;
            cell.styles.fontStyle = "bold";
          }
          // Total row
          if (row.index === catBody.length - 1) {
            cell.styles.fillColor = C.surface;
            cell.styles.fontStyle = "bold";
            cell.styles.fontSize = 8;
            if (column.index === 2) cell.styles.textColor = C.red;
          }
        }
      },
      margin: { left: M, right: M, top: M, bottom: M + 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── YoY Comparison ──
  sectionTitle(`Comparativo Interanual — ${Number(anio) - 1} vs ${anio}`);

  const buildVariation = (curr: number, prev: number, isMargin = false): string => {
    if (isMargin) {
      const diff = curr - prev;
      return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`;
    }
    const pct = pctChange(curr, prev);
    return pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : "N/A";
  };

  const yoyBody = [
    ["Ingresos", fmt(prevTotals.ingresos), fmt(totals.ingresos), buildVariation(totals.ingresos, prevTotals.ingresos)],
    ["Egresos", fmt(prevTotals.egresos), fmt(totals.egresos), buildVariation(totals.egresos, prevTotals.egresos)],
    [
      "Resultado Neto",
      `${prevTotals.resultado >= 0 ? "+" : "-"}${fmt(prevTotals.resultado)}`,
      `${totals.resultado >= 0 ? "+" : "-"}${fmt(totals.resultado)}`,
      buildVariation(totals.resultado, prevTotals.resultado),
    ],
    ["Margen", `${prevTotals.margen.toFixed(1)}%`, `${totals.margen.toFixed(1)}%`, buildVariation(totals.margen, prevTotals.margen, true)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Métrica", String(Number(anio) - 1), anio, "Variación"]],
    body: yoyBody,
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      textColor: C.lightGray,
      fillColor: C.bg,
      lineWidth: 0.2,
      lineColor: C.border,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: C.surface,
      textColor: C.gray,
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: "bold" },
      1: { halign: "right", cellWidth: 38 },
      2: { halign: "right", cellWidth: 38, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 32 },
    },
    willDrawPage: () => {
      doc.setFillColor(...C.bg);
      doc.rect(0, 0, pageW, pageH, "F");
    },
    didParseCell: (hookData) => {
      const { column, cell, row } = hookData;
      if (row.section === "body" && column.index === 3) {
        const val = String(cell.raw);
        cell.styles.textColor = val.startsWith("+") ? C.jade : val.startsWith("-") ? C.red : C.lightGray;
        cell.styles.fontStyle = "bold";
      }
      // Color current year column
      if (row.section === "body" && column.index === 2) {
        if (row.index === 0) cell.styles.textColor = C.jade;
        if (row.index === 1) cell.styles.textColor = C.red;
        if (row.index === 2) cell.styles.textColor = colorForValue(totals.resultado);
        if (row.index === 3) cell.styles.textColor = totals.margen >= 0 ? C.jade : C.red;
      }
    },
    margin: { left: M, right: M, top: M, bottom: M + 10 },
  });

  // ── Footer on all pages ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    // Footer bar
    doc.setFillColor(...C.surface);
    doc.rect(0, pageH - 10, pageW, 10, "F");

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.gray);
    doc.text(`Página ${p} de ${pageCount}`, M, pageH - 4);
    doc.text("Reporte generado automáticamente  •  Confidencial", pageW - M, pageH - 4, { align: "right" });
  }

  // ── Download ──
  doc.save(`Estado_Resultados_${anio}_${empresa.replace(/\s+/g, "_")}.pdf`);
}
