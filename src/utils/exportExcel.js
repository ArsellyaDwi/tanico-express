import * as XLSX from 'xlsx';

/**
 * Utility to export JavaScript array objects to genuine Microsoft Excel (.xlsx) files (single sheet).
 * @param {Array<Object>} data - Array of row objects to export
 * @param {string} fileName - Destination filename (without or with .xlsx extension)
 * @param {string} sheetName - Excel sheet name tab
 */
export function exportToExcel(data, fileName = 'tanico_export', sheetName = 'Sheet1') {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Tidak ada data untuk diekspor');
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Utility to export multiple sheets to a single Microsoft Excel (.xlsx) workbook.
 * @param {Array<{ sheetName: string, data: Array<Object> }>} sheets - Array of sheets with name and row objects
 * @param {string} fileName - Destination filename (without or with .xlsx extension)
 */
export function exportMultiSheetToExcel(sheets, fileName = 'tanico_laporan_analitik') {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error('Tidak ada sheet untuk diekspor');
  }

  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ sheetName, data }) => {
    const validData = Array.isArray(data) && data.length > 0
      ? data
      : [{ 'Keterangan': 'Tidak ada data untuk bagian ini.' }];
    const worksheet = XLSX.utils.json_to_sheet(validData);
    const safeSheetName = (sheetName || 'Sheet').replace(/[:\\/?*\[\]]/g, '').substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  link.setAttribute('download', cleanName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
