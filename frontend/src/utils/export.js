import jsPDF from "jspdf";
import "jspdf-autotable";

export const downloadCSV = async (filename, rows) => {
  if (!rows || !rows.length) throw new Error("No data available to export.");
  const headers = Object.keys(rows[0]).join(",");
  const csvContent = rows.map(r => 
    Object.values(r).map(val => {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",")
  );
  
  const csvString = [headers, ...csvContent].join("\n");
  // Add BOM for Excel UTF-8 support
  const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
  await triggerDownload(blob, `${filename}.csv`);
};

export const downloadJSON = async (filename, rows) => {
  if (!rows || !rows.length) throw new Error("No data available to export.");
  
  const jsonString = JSON.stringify(rows, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  await triggerDownload(blob, `${filename}.json`);
};

const triggerDownload = async (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Small delay to ensure the browser registers the download before we show success
  return new Promise(resolve => setTimeout(resolve, 300));
};

export const downloadPDF = (filename, title, rows) => {
  if (!rows || !rows.length) throw new Error("No data available to export.");
  
  const doc = new jsPDF();
  
  // Add Title
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  
  const headers = Object.keys(rows[0]);
  
  doc.autoTable({
    startY: 30,
    head: [headers],
    body: rows.map(r => headers.map(h => r[h] !== null && r[h] !== undefined ? String(r[h]) : "")),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] }
  });
  
  doc.save(`${filename}.pdf`);
};
