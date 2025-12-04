
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formStructure, FormField } from '../data/formStructure';
import { parsePdfText } from '../services/pdfParser';
import { extractDataWithRules } from '../services/ruleBasedParser';
import { UploadIcon, LoaderIcon, AlertTriangleIcon, ClipboardListIcon, FileTextIcon, FileSpreadsheetIcon, DownloadIcon, ChevronDownIcon } from './icons';

// Declarations for libraries loaded from CDN
declare const jspdf: any;
declare const XLSX: any;

interface jsPDFWithAutoTable {
  autoTable: (options: any) => jsPDFWithAutoTable;
  setFontSize(size: number): jsPDFWithAutoTable;
  setTextColor(r: number, g?: number, b?: number): jsPDFWithAutoTable;
  text(text: string | string[], x: number, y: number, options?: any): jsPDFWithAutoTable;
  save(filename: string): void;
  [key: string]: any;
}


interface MonthlyData {
    month: string;
    year: string;
    fileName: string;
    data: Record<string, number>;
}

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const SHORT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const getSimplifiedStructure = (range: '400' | '500') => {
    const section = formStructure.find(s => s.range === range);
    if (!section) return { title: '', rows: [], header: [] };

    const header = [
        { id: 'valorBruto', description: 'VALOR BRUTO' },
        { id: 'valorNeto', description: 'VALOR NETO' },
    ];

    const simplifiedRows = section.rows
        .filter(row => !row.isAccordion && !row.isHeader && !row.isTitle)
        .map(row => ({
            description: row.description,
            note: row.note,
            isTotal: row.isTotal,
            fields: [row.fields[0], row.fields[1]] as (FormField | null)[]
        }));

    return { title: section.title, rows: simplifiedRows, header };
};


const AnnualReport: React.FC = () => {
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [activeReportTab, setActiveReportTab] = useState<'400' | '500'>('400');
    const [activeMonthTab, setActiveMonthTab] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Close export menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const sortedMonths = useMemo(() => {
        return [...new Set<string>(monthlyData.map(d => d.month))]
            .sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b));
    }, [monthlyData]);

    const totalData = useMemo(() => {
        const totals: Record<string, number> = {};

        monthlyData.forEach(month => {
            for (const key in month.data) {
                totals[key] = (totals[key] || 0) + month.data[key];
            }
        });

        // Round final totals to 2 decimal places to avoid floating point inaccuracies
        for (const key in totals) {
            totals[key] = parseFloat(totals[key].toFixed(2));
        }

        return totals;
    }, [monthlyData]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        setError(null);
        setMonthlyData([]);

        const processFile = async (file: File): Promise<MonthlyData | null> => {
            try {
                const text = await parsePdfText(file);
                const extracted = await extractDataWithRules(text);
                if (!extracted.periodo) {
                    console.warn(`Could not determine period for file: ${file.name}`);
                    return null;
                }
                const [month, year] = extracted.periodo.split(' ');
                return { month, year, fileName: file.name, data: extracted.data };
            } catch (err) {
                console.error(`Failed to process ${file.name}:`, err);
                return null;
            }
        };

        try {
            const results = await Promise.all(Array.from(files).map(processFile));
            const validData = results.filter((d): d is MonthlyData => d !== null);
            
            if (validData.length === 0 && files.length > 0) {
                 throw new Error("No se pudo extraer datos válidos de ninguno de los archivos. Verifique que sean declaraciones de IVA.");
            }

            validData.sort((a, b) => MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month));
            setMonthlyData(validData);
            setActiveMonthTab('TOTAL'); // Default view to total
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else if (typeof err === 'string') {
                setError(err);
            } else {
                setError("Ocurrió un error desconocido al procesar los archivos.");
            }
        } finally {
            setIsProcessing(false);
            event.target.value = '';
        }
    };
    
    const handleExportPdf = () => {
        setIsExportMenuOpen(false);
        const { jsPDF } = jspdf;
        // Use Landscape orientation ('l')
        const doc = new jsPDF({ orientation: 'landscape' }) as jsPDFWithAutoTable;
        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();

        doc.setFontSize(18);
        doc.setTextColor(0, 51, 102); // sri-blue
        doc.text("Reporte Anual Consolidado de IVA", 14, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Período Fiscal: ${year}`, 14, 28);
        
        let finalY = 35;

        const sectionsToExport: { range: '400' | '500', title: string }[] = [
            { range: '400', title: 'RESUMEN DE VENTAS (CASILLEROS 400)' },
            { range: '500', title: 'RESUMEN DE COMPRAS Y PAGOS (CASILLEROS 500)' },
        ];

        sectionsToExport.forEach(sectionInfo => {
            const structure = getSimplifiedStructure(sectionInfo.range);
            const tableBody: (string | number)[][] = [];

            structure.rows.forEach(row => {
                // We will create a row for Bruto and a row for Neto if they exist
                const fieldTypes = [
                    { field: row.fields[0], suffix: '' }, // Bruto usually primary
                    { field: row.fields[1], suffix: ' (Neto)' } // Neto usually secondary
                ];

                fieldTypes.forEach(({ field, suffix }) => {
                    if (field) {
                        const totalVal = totalData[field.id] || 0;
                        // Only add row if there is a total value > 0 to save space
                        if (totalVal > 0) {
                            const rowData: (string | number)[] = [];
                            
                            // 1. Description
                            rowData.push(`${row.description}${suffix}`);
                            
                            // 2. Casillero ID
                            rowData.push(field.id);
                            
                            // 3. Values for each month
                            MONTHS_ORDER.forEach(monthName => {
                                const monthRecord = monthlyData.find(m => m.month === monthName);
                                const val = monthRecord ? (monthRecord.data[field.id] || 0) : 0;
                                rowData.push(val === 0 ? '-' : val.toFixed(2));
                            });

                            // 4. Total
                            rowData.push(totalVal.toFixed(2));
                            
                            tableBody.push(rowData);
                        }
                    }
                });
            });

            if (tableBody.length > 0) {
                // Header Row Construction
                const tableHeaders = [
                    'Descripción', 
                    'Cas.', 
                    ...SHORT_MONTHS, 
                    'TOTAL'
                ];

                doc.autoTable({
                    startY: finalY,
                    head: [[
                        { content: sectionInfo.title, colSpan: tableHeaders.length, styles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', halign: 'center' } }
                    ],
                    tableHeaders],
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 7, cellPadding: 1 }, // Smaller font for landscape table
                    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [22, 160, 233] },
                    columnStyles: { 
                        0: { cellWidth: 'auto' }, // Description gets remaining space
                        1: { halign: 'center', fontStyle: 'bold', cellWidth: 10 }, // Casillero ID
                        // Month columns (indexes 2 to 13)
                        ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 2, { halign: 'right', cellWidth: 15 }])),
                        14: { halign: 'right', fontStyle: 'bold', cellWidth: 18 } // Total
                    },
                    didDrawPage: (data) => {
                        finalY = data.cursor?.y ?? finalY;
                    }
                });
                finalY = (doc as any).lastAutoTable.finalY + 15;
            }
        });

        doc.save(`reporte_anual_iva_${year}_horizontal.pdf`);
    };

    const exportToExcel = (mode: 'full' | 'net') => {
        setIsExportMenuOpen(false);
        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();
        const sheetTitle = mode === 'full' ? `REPORTE ANUAL CONSOLIDADO IVA ${year}` : `REPORTE ANUAL (NETO) IVA ${year}`;
        const fileName = mode === 'full' ? `Reporte_Anual_IVA_${year}.xlsx` : `Reporte_Anual_IVA_Neto_${year}.xlsx`;

        // 1. Build Data Matrix
        let sheetData: (string | number)[][] = [];

        if (mode === 'full') {
            const headerRow1 = ["Descripción", "Cas. Bruto", "Cas. Neto"];
            const headerRow2 = ["", "", ""];

            MONTHS_ORDER.forEach(month => {
                headerRow1.push(month);
                headerRow1.push(""); 
                headerRow2.push("Bruto");
                headerRow2.push("Neto");
            });

            headerRow1.push("TOTAL ANUAL");
            headerRow1.push("");
            headerRow2.push("Bruto");
            headerRow2.push("Neto");

            sheetData = [
                [sheetTitle],
                [], 
                headerRow1,
                headerRow2
            ];
        } else {
            // Net Only Header
            const headerRow = ["Descripción", "Casillero", ...MONTHS_ORDER, "TOTAL ANUAL"];
            sheetData = [
                [sheetTitle],
                [], 
                headerRow
            ];
        }

        const sectionsToExport: { range: '400' | '500', title: string }[] = [
            { range: '400', title: 'RESUMEN DE VENTAS (CASILLEROS 400)' },
            { range: '500', title: 'RESUMEN DE COMPRAS Y PAGOS (CASILLEROS 500)' },
        ];

        sectionsToExport.forEach(section => {
            sheetData.push([section.title]); // Section Title
            
            const structure = getSimplifiedStructure(section.range);
            
            structure.rows.forEach(row => {
                const fieldBruto = row.fields[0];
                const fieldNeto = row.fields[1];

                const totalBruto = fieldBruto ? (totalData[fieldBruto.id] || 0) : 0;
                const totalNeto = fieldNeto ? (totalData[fieldNeto.id] || 0) : 0;

                if (mode === 'full') {
                    if (totalBruto > 0 || totalNeto > 0) {
                        const rowData: (string | number)[] = [
                            row.description,
                            fieldBruto ? Number(fieldBruto.id) : "", 
                            fieldNeto ? Number(fieldNeto.id) : ""
                        ];
                        MONTHS_ORDER.forEach(month => {
                            const monthData = monthlyData.find(m => m.month === month)?.data || {};
                            rowData.push(fieldBruto ? (monthData[fieldBruto.id] || 0) : 0);
                            rowData.push(fieldNeto ? (monthData[fieldNeto.id] || 0) : 0);
                        });
                        rowData.push(totalBruto);
                        rowData.push(totalNeto);
                        sheetData.push(rowData);
                    }
                } else {
                    // Net Only Logic
                    if (totalNeto > 0) {
                         const rowData: (string | number)[] = [
                            row.description,
                            fieldNeto ? Number(fieldNeto.id) : ""
                        ];
                        MONTHS_ORDER.forEach(month => {
                            const monthData = monthlyData.find(m => m.month === month)?.data || {};
                            rowData.push(fieldNeto ? (monthData[fieldNeto.id] || 0) : 0);
                        });
                        rowData.push(totalNeto);
                        sheetData.push(rowData);
                    }
                }
            });
            sheetData.push([]); 
        });

        // 2. Create Workbook and Sheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // 3. Styles Definitions
        const styles = {
            title: {
                font: { bold: true, sz: 16, color: { rgb: "FFFFFF" }, name: "Arial" },
                fill: { fgColor: { rgb: "003366" } }, // SRI Blue
                alignment: { horizontal: "center", vertical: "center" }
            },
            headerMonth: {
                font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial" },
                fill: { fgColor: { rgb: "00A6FB" } }, // Light Blue
                alignment: { horizontal: "center" },
                border: { bottom: { style: "thin" }, right: { style: "thin" } }
            },
            headerSub: {
                font: { bold: true, sz: 9, name: "Arial" },
                fill: { fgColor: { rgb: "E5E7EB" } }, // Gray 200
                alignment: { horizontal: "center" },
                border: { bottom: { style: "thin" }, right: { style: "thin" } }
            },
            sectionTitle: {
                font: { bold: true, color: { rgb: "003366" }, name: "Arial" },
                fill: { fgColor: { rgb: "FFD700" } }, // SRI Gold
                border: { bottom: { style: "medium" } }
            },
            cellText: {
                font: { name: "Arial", sz: 10 },
                alignment: { wrapText: true, vertical: "center" },
                border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } }
            },
            cellCode: {
                font: { name: "Courier New", sz: 10, bold: true, color: { rgb: "555555" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } }
            },
            cellNumber: {
                font: { name: "Arial", sz: 10 },
                alignment: { horizontal: "right", vertical: "center" },
                numFmt: "#,##0.00",
                border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } }
            }
        };

        // 4. Apply Styles & Merges
        if (!ws['!merges']) ws['!merges'] = [];
        
        // Merge Main Title
        const totalCols = mode === 'full' ? 28 : 15; // 3 header cols + 24 month cols + 2 totals | vs | 2 header cols + 12 month cols + 1 total
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
        ws['A1'].s = styles.title;

        if (mode === 'full') {
             // Merge Month Headers
            for (let i = 0; i < 13; i++) { 
                 const colStart = 3 + (i * 2);
                 ws['!merges'].push({ s: { r: 2, c: colStart }, e: { r: 2, c: colStart + 1 } });
            }
        }

        // Apply column widths
        const colWidths = [
            { wch: 50 }, // Description
        ];
        if (mode === 'full') {
            colWidths.push({ wch: 8 }); // Code Bruto
            colWidths.push({ wch: 8 }); // Code Neto
            for(let i=0; i < 26; i++) colWidths.push({ wch: 12 });
        } else {
            colWidths.push({ wch: 8 }); // Code Neto
            for(let i=0; i < 13; i++) colWidths.push({ wch: 12 });
        }
        ws['!cols'] = colWidths;

        // Iterate through all cells to apply styles
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue;

                // Title Row
                if (R === 0) {
                    ws[cellRef].s = styles.title;
                }
                
                if (mode === 'full') {
                    // Header Logic for Full Mode
                    if (R === 2) {
                        if (C < 3) ws[cellRef].s = styles.headerMonth;
                        else if (C >= 3) ws[cellRef].s = styles.headerMonth;
                    }
                    else if (R === 3) {
                        ws[cellRef].s = styles.headerSub;
                    }
                    else if (R > 3) {
                         const cellValue = ws[cellRef].v;
                        if (C === 0 && typeof cellValue === 'string' && (cellValue.includes("RESUMEN DE"))) {
                            ws[cellRef].s = styles.sectionTitle;
                        } 
                        else {
                            if (C === 0) ws[cellRef].s = styles.cellText;
                            else if (C === 1 || C === 2) ws[cellRef].s = styles.cellCode;
                            else ws[cellRef].s = styles.cellNumber;
                        }
                    }
                } else {
                     // Header Logic for Net Mode
                    if (R === 2) {
                         ws[cellRef].s = styles.headerMonth;
                    }
                    else if (R > 2) {
                         const cellValue = ws[cellRef].v;
                        if (C === 0 && typeof cellValue === 'string' && (cellValue.includes("RESUMEN DE"))) {
                            ws[cellRef].s = styles.sectionTitle;
                        } 
                        else {
                            if (C === 0) ws[cellRef].s = styles.cellText;
                            else if (C === 1) ws[cellRef].s = styles.cellCode;
                            else ws[cellRef].s = styles.cellNumber;
                        }
                    }
                }
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, `IVA ${year}`);
        XLSX.writeFile(wb, fileName);
    };

    const structure = getSimplifiedStructure(activeReportTab);
    
    const dataToDisplay = useMemo(() => {
        if (activeMonthTab === 'TOTAL') {
            return totalData;
        }
        return monthlyData.find(d => d.month === activeMonthTab)?.data || {};
    }, [activeMonthTab, monthlyData, totalData]);

    return (
        <div className="w-full max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-sri-blue dark:text-sri-gold">Reporte de Formulario IVA</h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <label 
                            htmlFor="pdf-report-upload"
                            className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue-light ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-sri-blue-light text-white hover:bg-opacity-90'}`}
                        >
                            {isProcessing ? (
                                <><LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> Procesando...</>
                            ) : (
                                <><UploadIcon className="w-5 h-5 mr-2" /> Llenar desde PDFs</>
                            )}
                        </label>
                        <input 
                            id="pdf-report-upload" 
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            accept="application/pdf"
                            onChange={handleFileChange}
                            disabled={isProcessing}
                            multiple
                        />
                    </div>
                    {monthlyData.length > 0 && (
                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue bg-sri-blue text-white hover:bg-opacity-90"
                            >
                                <DownloadIcon className="w-5 h-5 mr-2" />
                                Exportar
                                <ChevronDownIcon className="w-4 h-4 ml-2" />
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-50">
                                    <div className="py-1" role="menu" aria-orientation="vertical">
                                        <button
                                            onClick={handleExportPdf}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                                            role="menuitem"
                                        >
                                            <FileTextIcon className="w-4 h-4 mr-3 text-red-500" />
                                            Exportar a PDF
                                        </button>
                                        <button
                                            onClick={() => exportToExcel('full')}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                                            role="menuitem"
                                        >
                                            <FileSpreadsheetIcon className="w-4 h-4 mr-3 text-green-600" />
                                            Exportar a Excel (Detallado)
                                        </button>
                                        <button
                                            onClick={() => exportToExcel('net')}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                                            role="menuitem"
                                        >
                                            <FileSpreadsheetIcon className="w-4 h-4 mr-3 text-blue-600" />
                                            Exportar a Excel (Solo Netos)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
                    <AlertTriangleIcon className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
                </div>
            )}
            
            {monthlyData.length > 0 ? (
                 <>
                    {/* Level 2 Tabs: Months & Total */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                         <nav className="-mb-px flex space-x-4 px-4 overflow-x-auto" aria-label="Months">
                            {sortedMonths.map(month => (
                                <button key={month} onClick={() => setActiveMonthTab(month)} className={`${activeMonthTab === month ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold' : 'border-transparent text-gray-500 hover:text-gray-700'} flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>{month.substring(0,3)}</button>
                            ))}
                            {monthlyData.length > 0 && (
                                <button
                                    key="TOTAL"
                                    onClick={() => setActiveMonthTab('TOTAL')}
                                    className={`${activeMonthTab === 'TOTAL' ? 'border-sri-blue text-sri-blue dark:border-sri-gold dark:text-sri-gold font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'} flex-shrink-0 whitespace-nowrap py-4 px-2 border-b-2 font-medium text-sm`}
                                >
                                    TOTAL ANUAL
                                </button>
                            )}
                        </nav>
                    </div>

                    {/* Level 3 Tabs: Sections */}
                    <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                       <nav className="flex space-x-4 px-4" aria-label="Report Sections">
                            <button onClick={() => setActiveReportTab('400')} className={`${activeReportTab === '400' ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold' : 'border-transparent text-gray-500 hover:text-gray-700'} py-3 px-1 border-b-2 font-medium text-sm`}>VENTAS 400</button>
                            <button onClick={() => setActiveReportTab('500')} className={`${activeReportTab === '500' ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold' : 'border-transparent text-gray-500 hover:text-gray-700'} py-3 px-1 border-b-2 font-medium text-sm`}>COMPRAS Y PAGOS 500</button>
                        </nav>
                    </div>
                    
                    <div className="p-4">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-y-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-3/5">Descripción</th>
                                        {structure.header.map(h => <th key={h.id} scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/5">{h.description}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {structure.rows.map((row, index) => {
                                        const fieldBruto = row.fields[0];
                                        const fieldNeto = row.fields[1];
                                        const valueBruto = fieldBruto ? (dataToDisplay[fieldBruto.id] || 0) : 0;
                                        const valueNeto = fieldNeto ? (dataToDisplay[fieldNeto.id] || 0) : 0;
                                        if (valueBruto === 0 && valueNeto === 0) return null;
                                        
                                        return (
                                            <tr key={index} className={`transition-colors duration-150 ${row.isTotal ? "bg-sri-gold/20 dark:bg-sri-gold/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
                                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-700 dark:text-gray-300">
                                                    <p className={row.isTotal ? 'font-bold' : ''}>{row.description}</p>
                                                    {row.note && <p className="text-xs text-gray-400 italic mt-1">{row.note}</p>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-gray-800 dark:text-gray-200">
                                                    {fieldBruto && (
                                                        <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sri-blue-light/10 text-sri-blue dark:bg-sri-blue-light/20 dark:text-sri-blue-light border border-sri-blue-light/20">
                                                            {fieldBruto.id}
                                                        </span>
                                                    )}
                                                    {valueBruto.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-gray-800 dark:text-gray-200">
                                                    {fieldNeto && (
                                                        <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sri-blue-light/10 text-sri-blue dark:bg-sri-blue-light/20 dark:text-sri-blue-light border border-sri-blue-light/20">
                                                            {fieldNeto.id}
                                                        </span>
                                                    )}
                                                    {valueNeto.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-20 px-6">
                    <ClipboardListIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Inicie su reporte anual</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Haga clic en el botón "Llenar desde PDFs" para cargar sus declaraciones mensuales de IVA.</p>
                </div>
            )}
        </div>
    );
};

export default AnnualReport;
