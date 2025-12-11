
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formStructure, FormField } from '../data/formStructure';
import { parsePdfText } from '../services/pdfParser';
import { extractDataWithRules } from '../services/ruleBasedParser';
import { UploadIcon, LoaderIcon, AlertTriangleIcon, ClipboardListIcon, FileTextIcon, FileSpreadsheetIcon, DownloadIcon, ChevronDownIcon, TrashIcon } from './icons';

// Access globals via window to avoid declaration conflicts with TaxForm.tsx
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
const SHORT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const getSimplifiedStructure = (range: '400' | '500' | '700') => {
    const section = formStructure.find(s => s.range === range);
    if (!section) return { title: '', rows: [], header: [] };

    let header: { id: string, description: string }[] = [];
    let mapFields: (fields: (FormField | null)[]) => (FormField | null)[] = () => [];

    if (range === '700') {
        // Section 700 uses the 3rd column (index 2) for values based on formStructure.ts
        header = [
            { id: 'valor', description: 'VALOR' }
        ];
        mapFields = (fields) => [fields[2]]; // Map only the 3rd field
    } else {
        // Sections 400 and 500 use Bruto (0) and Neto (1)
        header = [
            { id: 'valorBruto', description: 'VALOR BRUTO' },
            { id: 'valorNeto', description: 'VALOR NETO' },
        ];
        mapFields = (fields) => [fields[0], fields[1]];
    }

    const simplifiedRows = section.rows
        .filter(row => !row.isAccordion && !row.isHeader && !row.isTitle)
        // For range 700, filter out rows that don't have the 3rd field or represent non-retention data if needed.
        // Based on request, we want "AGENTE DE RETENCIÓN". In formStructure, these rows have data in index 2.
        .filter(row => {
            if (range === '700') {
                // Ensure we only pick rows relevant to Agente Retencion (usually index 2 is populated)
                return row.fields[2] !== null || row.isTotal;
            }
            return true;
        })
        .map(row => ({
            description: row.description,
            note: row.note,
            isTotal: row.isTotal,
            fields: mapFields(row.fields)
        }));

    return { title: section.title, rows: simplifiedRows, header };
};


const AnnualReport: React.FC = () => {
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
    const [activeReportTab, setActiveReportTab] = useState<'400' | '500' | '700'>('400');
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

        // Round final totals to 2 decimal places to avoid floating point inaccuracies
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
                return { 
                    month, 
                    year, 
                    fileName: file.name, 
                    data: extracted.data,
                    identificacion: extracted.identificacion,
                    razonSocial: extracted.razonSocial
                };
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

            const foundRuc = validData.find(d => d.identificacion)?.identificacion;
            const foundName = validData.find(d => d.razonSocial)?.razonSocial;
            
            if (foundRuc && !ruc) setRuc(foundRuc);
            if (foundName && !razonSocial) setRazonSocial(foundName);

            validData.sort((a, b) => MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month));
            setMonthlyData(validData);
            setActiveMonthTab('TOTAL'); 
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
    
    const formatNumber = (num: number) => {
        return num.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleExportPdf = (mode: 'full' | 'net') => {
        setIsExportMenuOpen(false);
        const jspdf = getJsPDF();
        if (!jspdf) {
            setError("La librería jsPDF no está cargada.");
            return;
        }
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();
        const titleSuffix = mode === 'net' ? '(Resumido)' : '';
        const fileName = mode === 'net' ? `reporte_anual_iva_${year}_resumido.pdf` : `reporte_anual_iva_${year}_consolidado.pdf`;

        doc.setFontSize(18);
        doc.setTextColor(0, 51, 102); 
        doc.text(`Reporte Anual Consolidado de IVA ${titleSuffix}`, 14, 20);
        
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

        const sectionsToExport: { range: '400' | '500' | '700', title: string }[] = [
            { range: '400', title: 'RESUMEN DE VENTAS (CASILLEROS 400)' },
            { range: '500', title: 'RESUMEN DE COMPRAS Y PAGOS (CASILLEROS 500)' },
            { range: '700', title: 'AGENTE DE RETENCIÓN (CASILLEROS 700)' },
        ];

        sectionsToExport.forEach(sectionInfo => {
            const structure = getSimplifiedStructure(sectionInfo.range);
            const tableBody: (string | number)[][] = [];

            structure.rows.forEach(row => {
                // Determine fields to export based on range and mode
                let fieldConfigs;
                
                if (sectionInfo.range === '700') {
                    // For 700, there is only one value field
                    fieldConfigs = [{ field: row.fields[0], suffix: '' }];
                } else {
                    if (mode === 'full') {
                        fieldConfigs = [
                            { field: row.fields[0], suffix: ' (Bruto)' },
                            { field: row.fields[1], suffix: ' (Neto)' }
                        ];
                    } else {
                         // Net Only / Resumido: Only take the secondary field (Neto)
                         fieldConfigs = [{ field: row.fields[1], suffix: '' }];
                    }
                }

                fieldConfigs.forEach(({ field, suffix }) => {
                    if (field) {
                        const totalVal = totalData[field.id] || 0;
                        if (totalVal > 0) {
                            const rowData: (string | number)[] = [];
                            rowData.push(`${row.description}${suffix}`);
                            rowData.push(field.id);
                            
                            MONTHS_ORDER.forEach(monthName => {
                                const monthRecord = monthlyData.find(m => m.month === monthName);
                                const val = monthRecord ? (monthRecord.data[field.id] || 0) : 0;
                                rowData.push(val === 0 ? '-' : formatNumber(val));
                            });

                            rowData.push(formatNumber(totalVal));
                            tableBody.push(rowData);
                        }
                    }
                });
            });

            if (tableBody.length > 0) {
                const tableHeaders = ['Descripción', 'Cas.', ...SHORT_MONTHS, 'TOTAL'];
                
                const pageHeight = doc.internal.pageSize.height;
                if (finalY + 30 > pageHeight) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.autoTable({
                    startY: finalY,
                    head: [
                        [{ content: sectionInfo.title, colSpan: tableHeaders.length, styles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 } }],
                        tableHeaders
                    ],
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 }, 
                    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [22, 160, 233], lineColor: [0, 0, 0], lineWidth: 0.1 },
                    columnStyles: { 
                        0: { cellWidth: 'auto' }, 
                        1: { halign: 'center', fontStyle: 'bold', cellWidth: 8 }, 
                        ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 2, { halign: 'right', cellWidth: 17 }])),
                        14: { halign: 'right', fontStyle: 'bold', cellWidth: 22 } 
                    },
                    didDrawPage: (data: any) => {
                        finalY = data.cursor?.y ?? finalY;
                    }
                });
                finalY = (doc as any).lastAutoTable.finalY + 15;
            }
        });

        doc.save(fileName);
    };

    const exportToExcel = (mode: 'full' | 'net') => {
        setIsExportMenuOpen(false);
        const XLSX = getXLSX();
        if (!XLSX) {
            setError("La librería XLSX no está cargada.");
            return;
        }

        const year = monthlyData.length > 0 ? monthlyData[0].year : new Date().getFullYear();
        const sheetTitle = mode === 'full' ? `REPORTE ANUAL CONSOLIDADO IVA ${year}` : `REPORTE ANUAL (NETO/RESUMIDO) IVA ${year}`;
        const fileName = mode === 'full' ? `Reporte_Anual_IVA_${year}.xlsx` : `Reporte_Anual_IVA_Neto_${year}.xlsx`;

        let sheetData: (string | number)[][] = [[sheetTitle]];

        if (ruc) sheetData.push([`RUC: ${ruc}`]);
        if (razonSocial) sheetData.push([`RAZÓN SOCIAL: ${razonSocial}`]);
        sheetData.push([]);

        // Dynamic header generation based on mode is complex because columns shift.
        // Simplified approach: Always use "Description, Cas, Month1...Month12, Total" rows in Excel
        // but vary how many rows per item we generate.

        const headerRow = ["Descripción", "Casillero", ...MONTHS_ORDER, "TOTAL ANUAL"];
        sheetData.push(headerRow);

        const sectionsToExport: { range: '400' | '500' | '700', title: string }[] = [
            { range: '400', title: 'RESUMEN DE VENTAS (CASILLEROS 400)' },
            { range: '500', title: 'RESUMEN DE COMPRAS Y PAGOS (CASILLEROS 500)' },
            { range: '700', title: 'AGENTE DE RETENCIÓN (CASILLEROS 700)' },
        ];

        sectionsToExport.forEach(section => {
            sheetData.push([section.title]); 
            
            const structure = getSimplifiedStructure(section.range);
            
            structure.rows.forEach(row => {
                let fieldsToProcess;
                if (section.range === '700') {
                    fieldsToProcess = [{ field: row.fields[0], suffix: '' }];
                } else {
                     if (mode === 'full') {
                        fieldsToProcess = [
                            { field: row.fields[0], suffix: ' (Bruto)' },
                            { field: row.fields[1], suffix: ' (Neto)' }
                        ];
                    } else {
                        fieldsToProcess = [{ field: row.fields[1], suffix: '' }];
                    }
                }

                fieldsToProcess.forEach(({field, suffix}) => {
                    if (field) {
                        const totalVal = totalData[field.id] || 0;
                        if (totalVal > 0) {
                            const rowData: (string | number)[] = [
                                `${row.description}${suffix}`,
                                Number(field.id)
                            ];
                            MONTHS_ORDER.forEach(month => {
                                const monthData = monthlyData.find(m => m.month === month)?.data || {};
                                rowData.push(monthData[field.id] || 0);
                            });
                            rowData.push(totalVal);
                            sheetData.push(rowData);
                        }
                    }
                });
            });
            sheetData.push([]); 
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        const styles = {
            title: { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" }, name: "Arial" }, fill: { fgColor: { rgb: "003366" } }, alignment: { horizontal: "center", vertical: "center" } },
            metaInfo: { font: { bold: true, sz: 11, name: "Arial" } },
            header: { font: { bold: true, color: { rgb: "FFFFFF" }, name: "Arial" }, fill: { fgColor: { rgb: "00A6FB" } }, alignment: { horizontal: "center" }, border: { bottom: { style: "thin" }, right: { style: "thin" } } },
            sectionTitle: { font: { bold: true, color: { rgb: "003366" }, name: "Arial" }, fill: { fgColor: { rgb: "FFD700" } }, border: { bottom: { style: "medium" } } },
            cellText: { font: { name: "Arial", sz: 10 }, alignment: { wrapText: true, vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } } },
            cellCode: { font: { name: "Courier New", sz: 10, bold: true, color: { rgb: "555555" } }, alignment: { horizontal: "center", vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } } },
            cellNumber: { font: { name: "Arial", sz: 10 }, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0.00", border: { bottom: { style: "thin", color: { rgb: "E5E7EB" } } } }
        };

        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }); // Title Merge
        ws['A1'].s = styles.title;

        let headerRowStart = 1; 
        if (ruc) headerRowStart++;
        if (razonSocial) headerRowStart++;
        headerRowStart++; 

        const colWidths = [{ wch: 50 }, { wch: 10 }];
        for(let i=0; i < 13; i++) colWidths.push({ wch: 12 });
        ws['!cols'] = colWidths;

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue;

                if (R === 0) ws[cellRef].s = styles.title;
                else if (R < headerRowStart - 1) ws[cellRef].s = styles.metaInfo;
                else if (R === headerRowStart) ws[cellRef].s = styles.header;
                else if (R > headerRowStart) {
                     const cellValue = ws[cellRef].v;
                    if (C === 0 && typeof cellValue === 'string' && (cellValue.includes("RESUMEN DE") || cellValue.includes("AGENTE DE"))) {
                        ws[cellRef].s = styles.sectionTitle;
                    } else {
                        if (C === 0) ws[cellRef].s = styles.cellText;
                        else if (C === 1) ws[cellRef].s = styles.cellCode;
                        else ws[cellRef].s = styles.cellNumber;
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
                    {monthlyData.length > 0 && (
                        <button
                            onClick={handleClearData}
                            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                            title="Limpiar datos"
                        >
                            <TrashIcon className="w-5 h-5" />
                            <span className="hidden sm:inline ml-2">Limpiar</span>
                        </button>
                    )}
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
                                            onClick={() => handleExportPdf('full')}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                                            role="menuitem"
                                        >
                                            <FileTextIcon className="w-4 h-4 mr-3 text-red-500" />
                                            Exportar a PDF (Detallado)
                                        </button>
                                        <button
                                            onClick={() => handleExportPdf('net')}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                                            role="menuitem"
                                        >
                                            <FileTextIcon className="w-4 h-4 mr-3 text-blue-500" />
                                            Exportar a PDF (Resumido)
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
                                            Exportar a Excel (Resumido)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="report-ruc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">RUC</label>
                    <input 
                        type="text" 
                        id="report-ruc" 
                        value={ruc} 
                        onChange={(e) => setRuc(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sri-blue focus:ring-sri-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border"
                        placeholder="Ingrese RUC"
                    />
                </div>
                <div>
                    <label htmlFor="report-razonSocial" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Razón Social</label>
                    <input 
                        type="text" 
                        id="report-razonSocial" 
                        value={razonSocial} 
                        onChange={(e) => setRazonSocial(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sri-blue focus:ring-sri-blue sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 border"
                        placeholder="Ingrese Razón Social"
                    />
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
                            <button onClick={() => setActiveReportTab('700')} className={`${activeReportTab === '700' ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold' : 'border-transparent text-gray-500 hover:text-gray-700'} py-3 px-1 border-b-2 font-medium text-sm`}>AGENTE RET. IVA</button>
                        </nav>
                    </div>
                    
                    <div className="p-4">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-y-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-3/5">Descripción</th>
                                        {structure.header.map(h => <th key={h.id} scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{h.description}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {structure.rows.map((row, index) => {
                                        // Dynamic row rendering based on number of fields (1 for Retentions, 2 for others)
                                        const values = row.fields.map(field => field ? (dataToDisplay[field.id] || 0) : 0);
                                        const allZero = values.every(v => v === 0);
                                        if (allZero) return null;
                                        
                                        return (
                                            <tr key={index} className={`transition-colors duration-150 ${row.isTotal ? "bg-sri-gold/20 dark:bg-sri-gold/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
                                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-700 dark:text-gray-300">
                                                    <p className={row.isTotal ? 'font-bold' : ''}>{row.description}</p>
                                                    {row.note && <p className="text-xs text-gray-400 italic mt-1">{row.note}</p>}
                                                </td>
                                                {row.fields.map((field, i) => (
                                                    <td key={i} className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-gray-800 dark:text-gray-200">
                                                        {field && (
                                                            <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sri-blue-light/10 text-sri-blue dark:bg-sri-blue-light/20 dark:text-sri-blue-light border border-sri-blue-light/20">
                                                                {field.id}
                                                            </span>
                                                        )}
                                                        {values[i].toFixed(2)}
                                                    </td>
                                                ))}
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
