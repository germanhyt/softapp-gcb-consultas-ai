import type { ParsedTable } from "./parse-tables";

function getFilename(title: string, ext: string): string {
  const date = new Date().toISOString().split("T")[0];
  const clean = title
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `refugio_${clean || "datos"}_${date}.${ext}`;
}

/** Captura DOM vía SVG foreignObject: respeta oklch y CSS moderno (Tailwind v4). */
async function elementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  return toCanvas(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
}

export async function exportToExcel(
  table: ParsedTable,
  title?: string
): Promise<void> {
  const XLSX = await import("xlsx");

  const data = [table.headers, ...table.rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-width columns
  const colWidths = table.headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...table.rows.map((r) => (r[i] || "").length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, getFilename(title || "datos", "xlsx"));
}

export async function exportToPDF(
  element: HTMLElement,
  title?: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const canvas = await elementToCanvas(element);
  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 190; // A4 width minus margins
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF("p", "mm", "a4");

  if (title) {
    pdf.setFontSize(14);
    pdf.text(title, 10, 15);
  }

  const yOffset = title ? 22 : 10;
  pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, imgHeight);

  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text(
    `El Refugio - ${new Date().toLocaleDateString("es-PE")}`,
    10,
    pdf.internal.pageSize.height - 10,
  );

  pdf.save(getFilename(title || "reporte", "pdf"));
}

export async function exportToPNG(
  element: HTMLElement,
  title?: string
): Promise<void> {
  const canvas = await elementToCanvas(element);
  const link = document.createElement("a");
  link.download = getFilename(title || "grafico", "png");
  link.href = canvas.toDataURL("image/png");
  link.click();
}
