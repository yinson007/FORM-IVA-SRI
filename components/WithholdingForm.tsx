
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { withholdingStructure, WithholdingRow } from '../data/withholdingStructure';
import { parsePdfText } from '../services/pdfParser';
import { extractDataWithRules } from '../services/ruleBasedParser';
import { UploadIcon, LoaderIcon, AlertTriangleIcon, ClipboardListIcon, FileTextIcon, FileSpreadsheetIcon, DownloadIcon, ChevronDownIcon, TrashIcon } from './icons';

// Access globals via window
const getJsPDF = () => (window as any).jspdf;
const getXLSX = () => (window as any).XLSX;

interface MonthlyData {
    month: string;
    year: string;
    fileName: string;
    data: Record<string, number>;
    identificacion?: string;
    razonSocial?: string;
}

const MONTHS_ORDER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const WithholdingForm: React.FC = () => {
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [activeMonthTab, setActiveMonthTab] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [ruc, setRuc] = useState<string>('');
    const [razonSocial, setRazonSocial] = useState<string>('');
    
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
        // Round final totals
        for (const key in totals) {
            totals[key] = parseFloat(totals[key].toFixed(2));
        }
        return totals;
    }, [monthlyData]);

    const handleClearData = () => {
        if (window.confirm("¿Está seguro que desea borrar todos los datos cargados?")) {
            setMonthlyData([]);
            setActiveMonthTab('');
            setRuc('');
            setRazonSocial('');
            setError(null);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        setError(null);
        // Reset data to ensure clean state based on new upload batch
        setMonthlyData([]); 

        const processFile = async (file: File): Promise<MonthlyData | null> => {
            try {
                const text = await parsePdfText(file);
                // Use the updated rule parser that supports 3 and 4 digit codes
                const extracted = await extractDataWithRules(text);
                
                if (!extracted.periodo) {
                    console.warn(`No se pudo determinar el período para el archivo: ${file.name}`);
                    return null;
                }
                
                const [month, year] = extracted.periodo.split(' ');
                
                // Basic validation to check if it looks like a withholding form
                // Form 103 usually has specific codes like 302, 303, etc.
                const hasRelevance = Object.keys(extracted.data).some(k => k.startsWith('3') || k.startsWith('4') || k.startsWith('5'));
                
                if (!hasRelevance && Object.keys(extracted.data).length < 5) {
                     console.warn(`El archivo ${file.name} no parece contener datos de retenciones.`);
                     // Return null or maybe try to accept it anyway? Let's accept if it has period.
                }

                return { 
                    month, 
                    year, 
                    fileName: file.name, 
                    data: extracted.data,
                    identificacion: extracted.identificacion,
                    razonSocial: extracted.razonSocial
                };
            } catch (err) {
                console.error(`Error procesando ${file.name}:`, err);
                return null;
            }
        };

        try {
            const results = await Promise.all(Array.from(files).map(processFile));
            const validData = results.filter((d): d is MonthlyData => d !== null);
            
            if (validData.length === 0 && files.length > 0) {
                 throw new Error("No se pudieron extraer datos válidos. Verifique que los archivos sean declaraciones PDF del SRI (Formulario 103).");
            }

            const foundRuc = validData.find(d => d.identificacion)?.identificacion;
            const foundName = validData.find(d => d.razonSocial)?.razonSocial;
            
            if (foundRuc && !ruc) setRuc(foundRuc);
            if (foundName && !razonSocial) setRazonSocial(foundName);

            // Sort data by month
            validData.sort((a, b) => MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month));
            setMonthlyData(validData);
            setActiveMonthTab('TOTAL'); 
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError("Ocurrió un error desconocido al procesar los archivos.");
        } finally {
            setIsProcessing(false);
            event.target.value = '';
        }
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const dataToDisplay = useMemo(() => {
        if (activeMonthTab === 'TOTAL') {
            return totalData;
        }
        return monthlyData.find(d => d.month === activeMonthTab)?.data || {};
    }, [activeMonthTab, monthlyData, totalData]);

    // Resumen PDF Export (Original)
    const handleExportPdf = () => {
        setIsExportMenuOpen(false);
        const jspdf = getJsPDF();
        if (!jspdf) {
            setError("La librería jsPDF no está cargada.");
            return;
        }
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();
        const fileName = `reporte_retenciones_${year}.pdf`;

        doc.setFontSize(18);
        doc.setTextColor(0, 51, 102); 
        doc.text(`Reporte Anual de Retenciones en la Fuente (F103)`, 14, 20);
        
        doc.setFontSize(11);
        doc.setTextColor(50);
        
        let headerY = 28;
        if (ruc) {
            doc.text(`RUC: ${ruc}`, 14, headerY);
            headerY += 6;
        }
        if (razonSocial) {
            doc.text(`Razón Social: ${razonSocial}`, 14, headerY);
            headerY += 6;
        }
        
        doc.setTextColor(100);
        doc.text(`Período Fiscal: ${year}`, 14, headerY);
        
        let finalY = headerY + 10;

        const tableBody: (string | number)[][] = [];

        withholdingStructure.forEach(row => {
            // Include titles as bold rows
            if (row.isTitle) {
                 tableBody.push([row.description, '', '', '', '']);
                 return;
            }

            const baseField = row.baseField;
            const retField = row.retentionField;
            
            const valBase = baseField ? (totalData[baseField.id] || 0) : 0;
            const valRet = retField ? (totalData[retField.id] || 0) : 0;

            // Only add row if there is data in total
            if (valBase > 0 || valRet > 0) {
                tableBody.push([
                    row.description,
                    baseField?.id || '',
                    valBase === 0 ? '-' : formatNumber(valBase),
                    retField?.id || '',
                    valRet === 0 ? '-' : formatNumber(valRet)
                ]);
            }
        });

        if (tableBody.length > 0) {
            const tableHeaders = ['Descripción', 'Cas. Base', 'Base Imponible Total', 'Cas. Ret', 'Valor Retenido Total'];
            
            doc.autoTable({
                startY: finalY,
                head: [[
                    { content: "RESUMEN ANUAL DE RETENCIONES", colSpan: 5, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' } }
                ], tableHeaders],
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1 },
                headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [22, 160, 233], lineColor: [0,0,0], lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
                    2: { halign: 'right', cellWidth: 35 },
                    3: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
                    4: { halign: 'right', cellWidth: 35 },
                },
                didParseCell: function(data: any) {
                    // Check if it's a title row (empty codes and values)
                    if (data.section === 'body' && data.row.raw[1] === '' && data.row.raw[3] === '') {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                        if (data.column.index === 0) {
                           data.cell.colSpan = 5;
                        }
                    }
                }
            });
        }
        doc.save(fileName);
    };

    // Detailed PDF Export
    const handleExportPdfDetail = () => {
        setIsExportMenuOpen(false);
        const jspdf = getJsPDF();
        if (!jspdf) {
            setError("La librería jsPDF no está cargada.");
            return;
        }
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();
        const fileName = `reporte_detalle_retenciones_${year}.pdf`;

        // --- Header Logic (Title, RUC, Name) ---
        doc.setFontSize(16);
        doc.setTextColor(0, 51, 102);
        doc.text(`Reporte Detallado de Retenciones (Formulario 103)`, 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(50);
        let headerY = 28;
        if (ruc) {
            doc.text(`RUC: ${ruc}`, 14, headerY);
            headerY += 5;
        }
        if (razonSocial) {
            doc.text(`Razón Social: ${razonSocial}`, 14, headerY);
            headerY += 5;
        }
        doc.text(`Período Fiscal: ${year}`, 14, headerY);
        
        let finalY = headerY + 10;
        
        const shortMonths = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const tableHeaders = ['Descripción', 'Cas.', ...shortMonths, 'TOTAL'];

        // --- Table 1: Valor Retenido ---
        const retainedRows: (string | number)[][] = [];
        
        withholdingStructure.forEach(row => {
            if (row.isTitle) return; // Skip titles for detailed list
            const field = row.retentionField;
            if (!field) return;

            const totalVal = totalData[field.id] || 0;
            // Filter: only show rows with data
            if (totalVal > 0) {
                 const rowData: (string | number)[] = [
                    row.description,
                    field.id
                 ];
                 // Monthly values
                 MONTHS_ORDER.forEach(m => {
                     const mData = monthlyData.find(d => d.month === m);
                     const val = mData?.data[field.id] || 0;
                     rowData.push(val === 0 ? '-' : formatNumber(val));
                 });
                 // Total
                 rowData.push(formatNumber(totalVal));
                 retainedRows.push(rowData);
            }
        });

        // --- Table 2: Base Imponible ---
        const baseRows: (string | number)[][] = [];

        withholdingStructure.forEach(row => {
             if (row.isTitle) return;
             const field = row.baseField;
             if (!field) return;

             const totalVal = totalData[field.id] || 0;
             if (totalVal > 0) {
                 const rowData: (string | number)[] = [
                    row.description,
                    field.id
                 ];
                 MONTHS_ORDER.forEach(m => {
                     const mData = monthlyData.find(d => d.month === m);
                     const val = mData?.data[field.id] || 0;
                     rowData.push(val === 0 ? '-' : formatNumber(val));
                 });
                 rowData.push(formatNumber(totalVal));
                 baseRows.push(rowData);
             }
        });

        // Draw Table 1 (Retained)
        if (retainedRows.length > 0) {
             doc.autoTable({
                startY: finalY,
                head: [
                    [{ content: "DETALLE MENSUAL - VALOR RETENIDO", colSpan: 15, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' } }],
                    tableHeaders
                ],
                body: retainedRows,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1 },
                headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [22, 160, 233], lineColor: [0,0,0], lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 'auto' }, // Description
                    1: { halign: 'center', cellWidth: 8, fontStyle: 'bold' }, // Code
                    // Months columns (index 2-13)
                    ...Object.fromEntries(Array.from({length: 12}, (_, i) => [i+2, {halign: 'right', cellWidth: 15}])),
                    14: { halign: 'right', cellWidth: 20, fontStyle: 'bold' } // Total
                },
                didDrawPage: (data: any) => {
                    finalY = data.cursor?.y ?? finalY;
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        }

        // Check page break for Table 2
        const pageHeight = doc.internal.pageSize.height;
        if (finalY + 30 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        // Draw Table 2 (Base)
        if (baseRows.length > 0) {
             doc.autoTable({
                startY: finalY,
                head: [
                    [{ content: "DETALLE MENSUAL - BASE IMPONIBLE", colSpan: 15, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' } }],
                    tableHeaders
                ],
                body: baseRows,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.1 },
                headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [22, 160, 233], lineColor: [0,0,0], lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 'auto' }, // Description
                    1: { halign: 'center', cellWidth: 8, fontStyle: 'bold' }, // Code
                    ...Object.fromEntries(Array.from({length: 12}, (_, i) => [i+2, {halign: 'right', cellWidth: 15}])),
                    14: { halign: 'right', cellWidth: 20, fontStyle: 'bold' } // Total
                }
            });
        }
        
        doc.save(fileName);
    };

    const exportToExcel = () => {
        setIsExportMenuOpen(false);
        const XLSX = getXLSX();
        if (!XLSX) {
            setError("La librería XLSX no está cargada.");
            return;
        }

        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();
        const fileName = `Reporte_Retenciones_${year}.xlsx`;

        // 1. Build Header Data
        const headerRow1 = ["Descripción", "Cas. Base", "Cas. Ret"];
        const headerRow2 = ["", "", ""];

        MONTHS_ORDER.forEach(month => {
            headerRow1.push(month); // Merged in logic implicitly
            headerRow1.push("");
            headerRow2.push("Base");
            headerRow2.push("Retenido");
        });
        
        headerRow1.push("TOTAL ANUAL");
        headerRow1.push("");
        headerRow2.push("Base");
        headerRow2.push("Retenido");

        const sheetData: (string | number)[][] = [
            [`REPORTE ANUAL DE RETENCIONES ${year}`],
            [`RUC: ${ruc}`],
            [`RAZÓN SOCIAL: ${razonSocial}`],
            [], // Empty row for spacing
            headerRow1,
            headerRow2
        ];

        // Track indices of title rows to merge and style later
        const titleRowIndices: number[] = [];
        
        // 2. Build Data Rows
        withholdingStructure.forEach(row => {
            const rowData: (string | number)[] = [];
            
            if (row.isTitle) {
                // Add index relative to final sheet (current length of sheetData)
                titleRowIndices.push(sheetData.length);
                rowData.push(row.description);
                // Fill rest with empty strings
                for(let i = 1; i < headerRow1.length; i++) rowData.push("");
                sheetData.push(rowData);
                return;
            }

            const baseField = row.baseField;
            const retField = row.retentionField;

            // Check if there is ANY data for this row to decide if we export it
            const totalBase = baseField ? (totalData[baseField.id] || 0) : 0;
            const totalRet = retField ? (totalData[retField.id] || 0) : 0;

            if (totalBase > 0 || totalRet > 0) {
                rowData.push(row.description);
                rowData.push(baseField ? Number(baseField.id) : "");
                rowData.push(retField ? Number(retField.id) : "");

                // Monthly Data
                MONTHS_ORDER.forEach(month => {
                    const monthRecord = monthlyData.find(m => m.month === month);
                    const mData = monthRecord ? monthRecord.data : {};
                    rowData.push(baseField ? (mData[baseField.id] || 0) : 0);
                    rowData.push(retField ? (mData[retField.id] || 0) : 0);
                });

                // Total Data
                rowData.push(totalBase);
                rowData.push(totalRet);
                
                sheetData.push(rowData);
            }
        });

        // 3. Create Sheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // 4. Definitions for Elegant Styles
        const borderStyle = { style: "thin", color: { rgb: "BDBDBD" } }; // Soft gray border
        const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        
        const styles = {
            title: {
                font: { bold: true, sz: 16, color: { rgb: "FFFFFF" }, name: "Arial" },
                fill: { fgColor: { rgb: "003366" } }, // SRI Blue
                alignment: { horizontal: "center", vertical: "center" }
            },
            metaInfo: {
                font: { bold: true, sz: 11, name: "Arial", color: { rgb: "333333" } },
                alignment: { vertical: "center" }
            },
            headerMonth: {
                font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial", sz: 10 },
                fill: { fgColor: { rgb: "00A6FB" } }, // Light Blue
                alignment: { horizontal: "center", vertical: "center" },
                border: borders
            },
            headerSub: {
                font: { bold: true, sz: 9, name: "Arial", color: { rgb: "555555" } },
                fill: { fgColor: { rgb: "E5E7EB" } }, // Gray 200
                alignment: { horizontal: "center", vertical: "center" },
                border: borders
            },
            sectionTitle: {
                font: { bold: true, color: { rgb: "003366" }, name: "Arial", sz: 11 },
                fill: { fgColor: { rgb: "FFD700" } }, // SRI Gold
                alignment: { horizontal: "left", vertical: "center" },
                border: borders
            },
            cellText: {
                font: { name: "Arial", sz: 10 },
                alignment: { wrapText: true, vertical: "center" },
                border: borders
            },
            cellCode: {
                font: { name: "Courier New", sz: 10, bold: true, color: { rgb: "555555" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: borders
            },
            cellNumber: {
                font: { name: "Arial", sz: 10 },
                alignment: { horizontal: "right", vertical: "center" },
                numFmt: "#,##0.00",
                border: borders
            },
            cellTotalNumber: {
                font: { name: "Arial", sz: 10, bold: true },
                alignment: { horizontal: "right", vertical: "center" },
                numFmt: "#,##0.00",
                fill: { fgColor: { rgb: "F3F4F6" } }, // Very light gray
                border: borders
            }
        };

        // 5. Apply Merges and Styles
        if (!ws['!merges']) ws['!merges'] = [];
        const totalCols = headerRow1.length;

        // Merge Main Title
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

        // Merge Month Headers
        const headerRowIndex = 4; // 0:Title, 1:RUC, 2:Name, 3:Empty, 4:Months
        for (let i = 0; i < 13; i++) { // 12 months + 1 total
            const colStart = 3 + (i * 2);
            ws['!merges'].push({ s: { r: headerRowIndex, c: colStart }, e: { r: headerRowIndex, c: colStart + 1 } });
        }

        // Merge Section Titles
        titleRowIndices.forEach(rowIndex => {
             ws['!merges'].push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: totalCols - 1 } });
        });

        // Set Column Widths
        const wscols = [{wch: 60}, {wch: 10}, {wch: 10}];
        for(let i=0; i<26; i++) wscols.push({wch: 14});
        ws['!cols'] = wscols;

        // Iterate Range to Apply Styles
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue; // Skip empty cells if they aren't generated
                
                // Title Row
                if (R === 0) ws[cellRef].s = styles.title;
                // Meta Info
                else if (R > 0 && R < 3) ws[cellRef].s = styles.metaInfo;
                // Headers
                else if (R === headerRowIndex) ws[cellRef].s = styles.headerMonth;
                else if (R === headerRowIndex + 1) ws[cellRef].s = styles.headerSub;
                // Data Rows
                else if (R > headerRowIndex + 1) {
                     if (titleRowIndices.includes(R)) {
                         ws[cellRef].s = styles.sectionTitle;
                     } else {
                         if (C === 0) ws[cellRef].s = styles.cellText;
                         else if (C === 1 || C === 2) ws[cellRef].s = styles.cellCode;
                         else {
                             // Number cells
                             ws[cellRef].s = styles.cellNumber;
                             // Highlight Total Columns (Last 2)
                             if (C >= totalCols - 2) {
                                 ws[cellRef].s = styles.cellTotalNumber;
                             }
                         }
                     }
                }
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, "Retenciones");
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="w-full max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            {/* Header Section */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-sri-blue dark:text-sri-gold">Formulario Retenciones en la Fuente</h2>
                <div className="flex items-center gap-2">
                    {monthlyData.length > 0 && (
                        <button onClick={handleClearData} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">
                            <TrashIcon className="w-5 h-5" /> 
                            <span className="hidden sm:inline ml-2">Limpiar</span>
                        </button>
                    )}
                    
                    <div className="relative">
                        <label className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue-light ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-sri-blue-light text-white hover:bg-opacity-90'}`}>
                            {isProcessing ? <LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> : <UploadIcon className="w-5 h-5 mr-2" />}
                            Llenar desde PDFs
                        </label>
                        <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="application/pdf" onChange={handleFileChange} disabled={isProcessing} multiple />
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
                                    <div className="py-1" role="menu">
                                        <button onClick={handleExportPdf} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                                            <FileTextIcon className="w-4 h-4 mr-3 text-red-500" /> Exportar a PDF (Resumen)
                                        </button>
                                        <button onClick={handleExportPdfDetail} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                                            <FileTextIcon className="w-4 h-4 mr-3 text-red-600" /> Exportar PDF Detalle
                                        </button>
                                        <button onClick={exportToExcel} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center">
                                            <FileSpreadsheetIcon className="w-4 h-4 mr-3 text-green-600" /> Exportar a Excel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Metadata Inputs */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">RUC</label>
                    <input type="text" value={ruc} onChange={(e) => setRuc(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sri-blue focus:ring-sri-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border" placeholder="Ingrese RUC" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Razón Social</label>
                    <input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sri-blue focus:ring-sri-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border" placeholder="Ingrese Razón Social" />
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
                    {/* Month Tabs */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-4 px-4 overflow-x-auto">
                            {sortedMonths.map(month => (
                                <button key={month} onClick={() => setActiveMonthTab(month)} className={`${activeMonthTab === month ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold' : 'border-transparent text-gray-500 hover:text-gray-700'} flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                    {month.substring(0,3)}
                                </button>
                            ))}
                            <button onClick={() => setActiveMonthTab('TOTAL')} className={`${activeMonthTab === 'TOTAL' ? 'border-sri-blue text-sri-blue dark:border-sri-gold dark:text-sri-gold font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'} flex-shrink-0 whitespace-nowrap py-4 px-2 border-b-2 font-medium text-sm`}>
                                TOTAL ANUAL
                            </button>
                        </nav>
                    </div>

                    {/* Level 3 Tab Title */}
                    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                        <span className="text-sri-blue-light dark:text-sri-gold font-bold text-sm uppercase border-b-2 border-sri-blue-light dark:border-sri-gold pb-1">RET. A RESIDENTES</span>
                    </div>

                    {/* Table */}
                    <div className="p-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase w-2/5">Descripción</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cas. Base</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Base Imponible</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cas. Ret</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Valor Retenido</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {withholdingStructure.map((row, index) => {
                                    if (row.isTitle) {
                                        return (
                                            <tr key={index} className="bg-gray-100 dark:bg-gray-700">
                                                <td colSpan={5} className="px-6 py-2 text-sm font-bold text-sri-blue dark:text-sri-gold uppercase">{row.description}</td>
                                            </tr>
                                        );
                                    }

                                    const valBase = row.baseField ? (dataToDisplay[row.baseField.id] || 0) : 0;
                                    const valRet = row.retentionField ? (dataToDisplay[row.retentionField.id] || 0) : 0;

                                    if (valBase === 0 && valRet === 0) return null;

                                    return (
                                        <tr key={index} className={row.isTotal ? "bg-sri-gold/20 font-bold dark:bg-sri-gold/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.description}</td>
                                            
                                            <td className="px-4 py-4 text-center text-xs font-mono text-gray-500 dark:text-gray-400">
                                                {row.baseField && <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-500">{row.baseField.id}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-mono text-gray-900 dark:text-white">
                                                {valBase !== 0 ? formatNumber(valBase) : '-'}
                                            </td>
                                            
                                            <td className="px-4 py-4 text-center text-xs font-mono text-gray-500 dark:text-gray-400">
                                                {row.retentionField && <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-500">{row.retentionField.id}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-mono text-gray-900 dark:text-white">
                                                {valRet !== 0 ? formatNumber(valRet) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="text-center py-20 px-6">
                    <ClipboardListIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Inicie su reporte de Retenciones</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Haga clic en el botón "Llenar desde PDFs" para cargar sus declaraciones de Formulario 103.</p>
                </div>
            )}
        </div>
    );
};

export default WithholdingForm;
