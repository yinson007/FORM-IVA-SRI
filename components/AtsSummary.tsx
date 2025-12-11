
import React, { useState, useMemo } from 'react';
import { UploadIcon, LoaderIcon, AlertTriangleIcon, TrashIcon, FileCodeIcon, FileTextIcon, FileSpreadsheetIcon } from './icons';
import { docTypes, retentionCodes } from '../data/atsMapping';

// Declaración para acceder a la librería global cargada vía CDN
declare const jspdf: any;

interface AtsData {
    id: string; // Unique ID usually Month '01', '02' or '06','12' for semesters
    ruc: string;
    razonSocial: string;
    periodoLabel: string;
    anio: string;
    mes: string;
    compras: CompraSummary[];
    retencionesRenta: RetencionRentaSummary[];
    retencionesIva: RetencionIvaSummary[];
    totals: {
        compras: {
            bi0: number;
            bi12: number;
            biNoObj: number;
            montoIva: number;
        };
        retRenta: {
            base: number;
            valRet: number;
        };
        retIva: number;
    }
}

interface CompraSummary {
    cod: string;
    transaccion: string;
    count: number;
    bi0: number;
    bi12: number;
    biNoObj: number;
    montoIva: number;
}

interface RetencionRentaSummary {
    cod: string;
    concepto: string;
    count: number;
    base: number;
    valRet: number;
}

interface RetencionIvaSummary {
    operacion: string;
    concepto: string;
    valRet: number;
}

const MONTH_NAMES = [
    "", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", 
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

const MONTH_SHORT = [
    "", "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", 
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"
];

const AtsSummary: React.FC = () => {
    const [atsDataList, setAtsDataList] = useState<AtsData[]>([]);
    const [activeTab, setActiveTab] = useState<string>(''); // 'TOTAL', '01', '06', etc.
    const [isSemestral, setIsSemestral] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // --- XML Parsing Logic ---
    const parseSingleXML = (text: string, filename: string): AtsData => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error(`Error al analizar el archivo XML: ${filename}`);
        }

        const ivaNode = xmlDoc.getElementsByTagName("iva")[0];
        if (!ivaNode) throw new Error(`Estructura XML inválida en ${filename}: Falta nodo raíz 'iva'.`);

        // Metadata
        const ruc = ivaNode.getElementsByTagName("IdInformante")[0]?.textContent || "";
        const razonSocial = ivaNode.getElementsByTagName("razonSocial")[0]?.textContent || "";
        const anio = ivaNode.getElementsByTagName("Anio")[0]?.textContent || "";
        const mes = ivaNode.getElementsByTagName("Mes")[0]?.textContent || "00";
        
        let periodoLabel = `${MONTH_NAMES[parseInt(mes)] || 'DESCONOCIDO'} ${anio}`;
        if (isSemestral) {
            if (mes === '06') periodoLabel = `1er SEMESTRE ${anio}`;
            else if (mes === '12') periodoLabel = `2do SEMESTRE ${anio}`;
        }

        // Data Aggregation Maps
        const comprasMap = new Map<string, CompraSummary>();
        const retRentaMap = new Map<string, RetencionRentaSummary>();
        
        // Initialize IVA Buckets
        const ivaBuckets = {
            '10': 0, '20': 0, '30': 0, '50': 0, '70': 0, '100': 0, 'NC': 0 
        };

        const detalleCompras = xmlDoc.getElementsByTagName("detalleCompras");

        for (let i = 0; i < detalleCompras.length; i++) {
            const item = detalleCompras[i];
            
            // --- Compras ---
            const tipoComp = item.getElementsByTagName("tipoComprobante")[0]?.textContent || "00";
            
            const bi0 = parseFloat(item.getElementsByTagName("baseImponible")[0]?.textContent || "0");
            const bi12 = parseFloat(item.getElementsByTagName("baseImpGrav")[0]?.textContent || "0");
            const biNoObj = parseFloat(item.getElementsByTagName("baseNoGraIva")[0]?.textContent || "0");
            const biExenta = parseFloat(item.getElementsByTagName("baseImpExe")[0]?.textContent || "0");
            const montoIva = parseFloat(item.getElementsByTagName("montoIva")[0]?.textContent || "0");

            const currentCompra = comprasMap.get(tipoComp) || {
                cod: tipoComp,
                transaccion: docTypes[tipoComp] || `TIPO ${tipoComp}`,
                count: 0,
                bi0: 0,
                bi12: 0,
                biNoObj: 0,
                montoIva: 0
            };

            currentCompra.count++;
            currentCompra.bi0 += bi0; 
            currentCompra.bi12 += bi12;
            currentCompra.biNoObj += biNoObj + biExenta; 
            currentCompra.montoIva += montoIva;
            comprasMap.set(tipoComp, currentCompra);

            // --- Retenciones Renta (AIR) ---
            const airDetails = item.getElementsByTagName("detalleAir");
            for(let j=0; j<airDetails.length; j++) {
                const air = airDetails[j];
                const codRet = air.getElementsByTagName("codRetAir")[0]?.textContent || "000";
                const baseAir = parseFloat(air.getElementsByTagName("baseImpAir")[0]?.textContent || "0");
                const valRetAir = parseFloat(air.getElementsByTagName("valRetAir")[0]?.textContent || "0");

                if (valRetAir > 0 || baseAir > 0) {
                    const currentAir = retRentaMap.get(codRet) || {
                        cod: codRet,
                        concepto: retentionCodes[codRet] || `RETENCIÓN COD ${codRet}`,
                        count: 0,
                        base: 0,
                        valRet: 0
                    };
                    currentAir.count++;
                    currentAir.base += baseAir;
                    currentAir.valRet += valRetAir;
                    retRentaMap.set(codRet, currentAir);
                }
            }

            // --- Retenciones IVA ---
            ivaBuckets['10'] += parseFloat(item.getElementsByTagName("valRetBien10")[0]?.textContent || "0");
            ivaBuckets['20'] += parseFloat(item.getElementsByTagName("valRetServ20")[0]?.textContent || "0");
            ivaBuckets['30'] += parseFloat(item.getElementsByTagName("valorRetBienes")[0]?.textContent || "0");
            ivaBuckets['50'] += parseFloat(item.getElementsByTagName("valRetServ50")[0]?.textContent || "0");
            ivaBuckets['70'] += parseFloat(item.getElementsByTagName("valorRetServicios")[0]?.textContent || "0");
            ivaBuckets['100'] += parseFloat(item.getElementsByTagName("valRetServ100")[0]?.textContent || "0");
            ivaBuckets['NC'] += parseFloat(item.getElementsByTagName("valorRetencionNc")[0]?.textContent || "0");
        }

        const comprasArray = Array.from(comprasMap.values()).sort((a,b) => a.cod.localeCompare(b.cod));
        const retRentaArray = Array.from(retRentaMap.values()).sort((a,b) => a.cod.localeCompare(b.cod));

        const retIvaArray: RetencionIvaSummary[] = [
            { operacion: 'COMPRA', concepto: 'Retención IVA 10%', valRet: ivaBuckets['10'] },
            { operacion: 'COMPRA', concepto: 'Retención IVA 20%', valRet: ivaBuckets['20'] },
            { operacion: 'COMPRA', concepto: 'Retención IVA 30%', valRet: ivaBuckets['30'] },
            { operacion: 'COMPRA', concepto: 'Retención IVA 50%', valRet: ivaBuckets['50'] },
            { operacion: 'COMPRA', concepto: 'Retención IVA 70%', valRet: ivaBuckets['70'] },
            { operacion: 'COMPRA', concepto: 'Retención IVA 100%', valRet: ivaBuckets['100'] },
        ];
        if (ivaBuckets['NC'] > 0) {
             retIvaArray.push({ operacion: 'COMPRA', concepto: 'Retención IVA NC', valRet: ivaBuckets['NC'] });
        }

        // Logic for Total Compras: Subtract values if Code is '04' (Nota de Crédito)
        const totalCompras = {
            bi0: comprasArray.reduce((sum, c) => c.cod === '04' ? sum - c.bi0 : sum + c.bi0, 0),
            bi12: comprasArray.reduce((sum, c) => c.cod === '04' ? sum - c.bi12 : sum + c.bi12, 0),
            biNoObj: comprasArray.reduce((sum, c) => c.cod === '04' ? sum - c.biNoObj : sum + c.biNoObj, 0),
            montoIva: comprasArray.reduce((sum, c) => c.cod === '04' ? sum - c.montoIva : sum + c.montoIva, 0),
        };

        const totalRetRenta = {
            base: retRentaArray.reduce((sum, c) => sum + c.base, 0),
            valRet: retRentaArray.reduce((sum, c) => sum + c.valRet, 0),
        };

        const totalRetIva = retIvaArray.reduce((sum, c) => sum + c.valRet, 0);

        return {
            id: mes,
            ruc,
            razonSocial,
            periodoLabel,
            anio,
            mes,
            compras: comprasArray,
            retencionesRenta: retRentaArray,
            retencionesIva: retIvaArray,
            totals: {
                compras: totalCompras,
                retRenta: totalRetRenta,
                retIva: totalRetIva
            }
        };
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        setError(null);
        // Clear previous data to start fresh batch
        setAtsDataList([]); 

        try {
            const parsedResults: AtsData[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const text = await file.text();
                const data = parseSingleXML(text, file.name);
                parsedResults.push(data);
            }
            
            // Sort by month
            parsedResults.sort((a, b) => parseInt(a.mes) - parseInt(b.mes));
            
            setAtsDataList(parsedResults);
            setActiveTab('TOTAL');

        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido al procesar los archivos.");
        } finally {
            setIsProcessing(false);
            event.target.value = '';
        }
    };

    // --- Consolidation Logic for TOTAL Tab ---
    const consolidatedData = useMemo((): AtsData | null => {
        if (atsDataList.length === 0) return null;
        if (activeTab !== 'TOTAL') {
            return atsDataList.find(d => d.id === activeTab) || null;
        }

        // Aggregate All
        const base = atsDataList[0]; // Use first for metadata (RUC, Name)
        
        // Maps for merging
        const comprasMap = new Map<string, CompraSummary>();
        const retRentaMap = new Map<string, RetencionRentaSummary>();
        const retIvaMap = new Map<string, number>();

        atsDataList.forEach(data => {
            // Merge Compras
            data.compras.forEach(c => {
                const existing = comprasMap.get(c.cod) || { ...c, count: 0, bi0: 0, bi12: 0, biNoObj: 0, montoIva: 0 };
                existing.count += c.count;
                existing.bi0 += c.bi0;
                existing.bi12 += c.bi12;
                existing.biNoObj += c.biNoObj;
                existing.montoIva += c.montoIva;
                comprasMap.set(c.cod, existing);
            });

            // Merge Ret Renta
            data.retencionesRenta.forEach(r => {
                const existing = retRentaMap.get(r.cod) || { ...r, count: 0, base: 0, valRet: 0 };
                existing.count += r.count;
                existing.base += r.base;
                existing.valRet += r.valRet;
                retRentaMap.set(r.cod, existing);
            });

            // Merge Ret IVA
            data.retencionesIva.forEach(r => {
                const currentVal = retIvaMap.get(r.concepto) || 0;
                retIvaMap.set(r.concepto, currentVal + r.valRet);
            });
        });

        const mergedCompras = Array.from(comprasMap.values()).sort((a,b) => a.cod.localeCompare(b.cod));
        const mergedRetRenta = Array.from(retRentaMap.values()).sort((a,b) => a.cod.localeCompare(b.cod));
        
        // Reconstruct Ret IVA Array preserving standard order if possible
        const standardIvaConcepts = ['Retención IVA 10%', 'Retención IVA 20%', 'Retención IVA 30%', 'Retención IVA 50%', 'Retención IVA 70%', 'Retención IVA 100%', 'Retención IVA NC'];
        const mergedRetIva: RetencionIvaSummary[] = [];
        
        standardIvaConcepts.forEach(concept => {
            if (retIvaMap.has(concept)) {
                mergedRetIva.push({
                    operacion: 'COMPRA',
                    concepto: concept,
                    valRet: retIvaMap.get(concept) || 0
                });
            }
        });
        // Add any non-standard if existed (fallback)
        retIvaMap.forEach((val, key) => {
            if (!standardIvaConcepts.includes(key)) {
                mergedRetIva.push({ operacion: 'COMPRA', concepto: key, valRet: val });
            }
        });

        // Recalculate Totals
        // IMPORTANT: Subtract values if Code is '04' (Nota de Crédito)
        const totalCompras = {
            bi0: mergedCompras.reduce((s, c) => c.cod === '04' ? s - c.bi0 : s + c.bi0, 0),
            bi12: mergedCompras.reduce((s, c) => c.cod === '04' ? s - c.bi12 : s + c.bi12, 0),
            biNoObj: mergedCompras.reduce((s, c) => c.cod === '04' ? s - c.biNoObj : s + c.biNoObj, 0),
            montoIva: mergedCompras.reduce((s, c) => c.cod === '04' ? s - c.montoIva : s + c.montoIva, 0),
        };
        const totalRetRenta = {
            base: mergedRetRenta.reduce((s, c) => s + c.base, 0),
            valRet: mergedRetRenta.reduce((s, c) => s + c.valRet, 0),
        };
        const totalRetIva = mergedRetIva.reduce((s, c) => s + c.valRet, 0);

        return {
            ...base,
            periodoLabel: `CONSOLIDADO ${atsDataList.length} PERIODO(S) ${base.anio}`,
            compras: mergedCompras,
            retencionesRenta: mergedRetRenta,
            retencionesIva: mergedRetIva,
            totals: {
                compras: totalCompras,
                retRenta: totalRetRenta,
                retIva: totalRetIva
            }
        };

    }, [atsDataList, activeTab]);


    const formatMoney = (val: number) => val.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleClear = () => {
        if(window.confirm("¿Está seguro de limpiar los datos del Talon ATS?")) {
            setAtsDataList([]);
            setError(null);
        }
    }

    const toggleMode = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (atsDataList.length > 0) {
            if(!window.confirm("Cambiar de modo borrará los datos actuales. ¿Continuar?")) {
                e.preventDefault(); 
                return;
            }
            setAtsDataList([]);
        }
        setIsSemestral(e.target.checked);
    }

    // Determine Tabs to show
    const tabs = useMemo(() => {
        if (atsDataList.length === 0) return [];
        
        const generatedTabs = atsDataList.map(d => {
            let label = d.id;
            if (isSemestral) {
                if (d.mes === '06') label = '1er SEMESTRE';
                else if (d.mes === '12') label = '2do SEMESTRE';
                else label = `SEM. (${d.mes})`;
            } else {
                // Monthly Labels
                label = MONTH_SHORT[parseInt(d.mes)] || d.mes;
            }
            return { id: d.id, label };
        });

        // Always add TOTAL
        generatedTabs.push({ id: 'TOTAL', label: 'TOTAL' });
        return generatedTabs;
    }, [atsDataList, isSemestral]);

    // --- PDF EXPORT FUNCTION (BY MONTH) ---
    const handleExportPdf = () => {
        if (atsDataList.length === 0) return;
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });

        // Iterate through each period (months) loaded in the list
        atsDataList.forEach((data, index) => {
            if (index > 0) doc.addPage();

            // Header
            doc.setFontSize(16);
            doc.setTextColor(0, 51, 102);
            doc.text(`Talón Resumen ATS - ${data.periodoLabel}`, 14, 15);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`RUC: ${data.ruc}`, 14, 22);
            doc.text(`Razón Social: ${data.razonSocial}`, 14, 27);

            let currentY = 35;

            // --- TABLE 1: COMPRAS ---
            const comprasBody = data.compras.map(c => [
                c.cod,
                c.transaccion,
                c.count,
                formatMoney(c.bi0),
                formatMoney(c.bi12),
                formatMoney(c.biNoObj),
                formatMoney(c.montoIva)
            ]);

            // Add Total Row
            comprasBody.push([
                { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
                { content: formatMoney(data.totals.compras.bi0), styles: { fontStyle: 'bold' } },
                { content: formatMoney(data.totals.compras.bi12), styles: { fontStyle: 'bold' } },
                { content: formatMoney(data.totals.compras.biNoObj), styles: { fontStyle: 'bold' } },
                { content: formatMoney(data.totals.compras.montoIva), styles: { fontStyle: 'bold' } }
            ]);

            doc.autoTable({
                startY: currentY,
                head: [[{ content: 'COMPRAS', colSpan: 7, styles: { halign: 'center', fillColor: [200, 200, 200], textColor: 0 } }],[
                    'Cod', 'Transacción', 'No. Reg', 'BI 0%', 'BI 12%', 'No Obj', 'Monto IVA'
                ]],
                body: comprasBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1 },
                headStyles: { fillColor: [0, 51, 102] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 25, halign: 'right' },
                    4: { cellWidth: 25, halign: 'right' },
                    5: { cellWidth: 25, halign: 'right' },
                    6: { cellWidth: 25, halign: 'right' }
                },
                didDrawPage: (data: any) => currentY = data.cursor.y
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;

            // --- TABLE 2: RETENCIONES RENTA ---
            const rentaBody = data.retencionesRenta.map(r => [
                r.cod,
                r.concepto,
                r.count,
                formatMoney(r.base),
                formatMoney(r.valRet)
            ]);

            rentaBody.push([
                { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
                { content: formatMoney(data.totals.retRenta.base), styles: { fontStyle: 'bold' } },
                { content: formatMoney(data.totals.retRenta.valRet), styles: { fontStyle: 'bold' } }
            ]);

            // Check if page break needed
            if (currentY + 40 > doc.internal.pageSize.height) {
                doc.addPage();
                currentY = 15;
            }

            doc.autoTable({
                startY: currentY,
                head: [[{ content: 'RETENCIONES RENTA', colSpan: 5, styles: { halign: 'center', fillColor: [200, 200, 200], textColor: 0 } }],[
                    'Cod', 'Concepto', 'No. Reg', 'Base Imponible', 'Valor Retenido'
                ]],
                body: rentaBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1 },
                headStyles: { fillColor: [0, 51, 102] },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 30, halign: 'right' },
                    4: { cellWidth: 30, halign: 'right' }
                },
                didDrawPage: (data: any) => currentY = data.cursor.y
            });
            
            currentY = (doc as any).lastAutoTable.finalY + 10;

            // --- TABLE 3: RETENCIONES IVA ---
            const ivaBody = data.retencionesIva.map(i => [
                i.operacion,
                i.concepto,
                formatMoney(i.valRet)
            ]);

            ivaBody.push([
                { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
                { content: formatMoney(data.totals.retIva), styles: { fontStyle: 'bold' } }
            ]);

             // Check if page break needed
             if (currentY + 40 > doc.internal.pageSize.height) {
                doc.addPage();
                currentY = 15;
            }

            doc.autoTable({
                startY: currentY,
                head: [[{ content: 'RETENCIONES IVA', colSpan: 3, styles: { halign: 'center', fillColor: [200, 200, 200], textColor: 0 } }],[
                    'Operación', 'Concepto', 'Valor Retenido'
                ]],
                body: ivaBody,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1 },
                headStyles: { fillColor: [0, 51, 102] },
                columnStyles: {
                    0: { cellWidth: 40, halign: 'center' },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 30, halign: 'right' }
                }
            });
        });

        doc.save(`Talon_ATS_Mensual_${new Date().getTime()}.pdf`);
    };

    // --- NEW: ANNUAL MATRIX REPORT FUNCTION ---
    const handleExportAnnualMatrixPdf = () => {
        if (atsDataList.length === 0) return;
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
        
        const year = atsDataList[0].anio;
        const ruc = atsDataList[0].ruc;
        const name = atsDataList[0].razonSocial;

        doc.setFontSize(16);
        doc.setTextColor(0, 51, 102);
        doc.text(`Reporte Anual Consolidado ATS - ${year}`, 14, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`RUC: ${ruc} - ${name}`, 14, 22);

        let currentY = 30;
        
        const getMonthData = (monthIndex: number) => {
            const monthStr = monthIndex.toString().padStart(2, '0');
            return atsDataList.find(d => d.mes === monthStr);
        };

        const monthHeaders = MONTH_SHORT.slice(1); // ENE..DIC
        const tableHeaders = ['Cod', 'Descripción', ...monthHeaders, 'TOTAL'];
        
        const blackBorderStyles = { lineColor: [0, 0, 0], lineWidth: 0.1 };
        const footerStyles = { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: 0 };
        
        // ------------------------------------------
        // SECTION 1: COMPRAS (Base Imponible Total)
        // ------------------------------------------
        const purchaseCodes = new Set<string>();
        atsDataList.forEach(m => m.compras.forEach(c => purchaseCodes.add(c.cod)));
        const sortedPurchaseCodes = Array.from(purchaseCodes).sort();

        const comprasBody: (string | number)[][] = [];
        const comprasTotals = Array(13).fill(0); // 0-11 for months (1-12), 12 for Row Total

        sortedPurchaseCodes.forEach(code => {
            let description = docTypes[code] || `TIPO ${code}`;
            if(description.length > 30) description = description.substring(0, 28) + '..';

            const row: (string | number)[] = [code, description];
            let rowTotal = 0;

            for (let i = 1; i <= 12; i++) {
                const mData = getMonthData(i);
                if (mData) {
                    const compra = mData.compras.find(c => c.cod === code);
                    if (compra) {
                        let val = compra.bi0 + compra.bi12 + compra.biNoObj;
                        if (code === '04') val = val * -1;
                        row.push(formatMoney(val));
                        rowTotal += val;
                        comprasTotals[i-1] += val;
                    } else {
                        row.push('-');
                    }
                } else {
                    row.push('-');
                }
            }
            row.push(formatMoney(rowTotal));
            comprasTotals[12] += rowTotal;
            comprasBody.push(row);
        });

        const comprasFooter = [
            { content: 'TOTAL', colSpan: 2, styles: { halign: 'right' } },
            ...comprasTotals.map(v => formatMoney(v))
        ];

        doc.autoTable({
            startY: currentY,
            head: [[{ content: 'COMPRAS (BASE IMPONIBLE TOTAL)', colSpan: 14, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.1 } }],
                   tableHeaders],
            body: comprasBody,
            foot: [comprasFooter],
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, ...blackBorderStyles },
            headStyles: { fillColor: [22, 160, 233], textColor: 255, ...blackBorderStyles },
            footStyles: { ...footerStyles, ...blackBorderStyles },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                ...Object.fromEntries(Array.from({length: 13}, (_, i) => [i+2, {halign: 'right', cellWidth: 15}]))
            },
            didDrawPage: (data: any) => currentY = data.cursor.y
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY + 50 > doc.internal.pageSize.height) { doc.addPage(); currentY = 15; }

        // ------------------------------------------
        // SECTION 2: RETENCIONES RENTA (BASE IMPONIBLE)
        // ------------------------------------------
        const rentCodes = new Set<string>();
        atsDataList.forEach(m => m.retencionesRenta.forEach(r => rentCodes.add(r.cod)));
        const sortedRentCodes = Array.from(rentCodes).sort();

        const rentBaseBody: (string | number)[][] = [];
        const rentBaseTotals = Array(13).fill(0);

        sortedRentCodes.forEach(code => {
            let description = '';
            for(const m of atsDataList) {
                const found = m.retencionesRenta.find(r => r.cod === code);
                if(found) { description = found.concepto; break; }
            }
            if(description.length > 30) description = description.substring(0, 28) + '..';

            const row: (string | number)[] = [code, description];
            let rowTotal = 0;

            for (let i = 1; i <= 12; i++) {
                const mData = getMonthData(i);
                if (mData) {
                    const ret = mData.retencionesRenta.find(r => r.cod === code);
                    if (ret) {
                        row.push(formatMoney(ret.base));
                        rowTotal += ret.base;
                        rentBaseTotals[i-1] += ret.base;
                    } else {
                        row.push('-');
                    }
                } else {
                    row.push('-');
                }
            }
            row.push(formatMoney(rowTotal));
            rentBaseTotals[12] += rowTotal;
            rentBaseBody.push(row);
        });

        const rentBaseFooter = [
            { content: 'TOTAL', colSpan: 2, styles: { halign: 'right' } },
            ...rentBaseTotals.map(v => formatMoney(v))
        ];

        doc.autoTable({
            startY: currentY,
            head: [[{ content: 'RETENCIONES RENTA (BASE IMPONIBLE)', colSpan: 14, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.1 } }],
                   tableHeaders],
            body: rentBaseBody,
            foot: [rentBaseFooter],
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, ...blackBorderStyles },
            headStyles: { fillColor: [22, 160, 233], textColor: 255, ...blackBorderStyles },
            footStyles: { ...footerStyles, ...blackBorderStyles },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                ...Object.fromEntries(Array.from({length: 13}, (_, i) => [i+2, {halign: 'right', cellWidth: 15}]))
            },
            didDrawPage: (data: any) => currentY = data.cursor.y
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY + 50 > doc.internal.pageSize.height) { doc.addPage(); currentY = 15; }

        // ------------------------------------------
        // SECTION 3: RETENCIONES RENTA (VALOR RETENIDO)
        // ------------------------------------------
        const rentBody: (string | number)[][] = [];
        const rentTotals = Array(13).fill(0);

        sortedRentCodes.forEach(code => {
            let description = '';
            for(const m of atsDataList) {
                const found = m.retencionesRenta.find(r => r.cod === code);
                if(found) { description = found.concepto; break; }
            }
            if(description.length > 30) description = description.substring(0, 28) + '..';

            const row: (string | number)[] = [code, description];
            let rowTotal = 0;

            for (let i = 1; i <= 12; i++) {
                const mData = getMonthData(i);
                if (mData) {
                    const ret = mData.retencionesRenta.find(r => r.cod === code);
                    if (ret) {
                        row.push(formatMoney(ret.valRet));
                        rowTotal += ret.valRet;
                        rentTotals[i-1] += ret.valRet;
                    } else {
                        row.push('-');
                    }
                } else {
                    row.push('-');
                }
            }
            row.push(formatMoney(rowTotal));
            rentTotals[12] += rowTotal;
            rentBody.push(row);
        });

        const rentFooter = [
            { content: 'TOTAL', colSpan: 2, styles: { halign: 'right' } },
            ...rentTotals.map(v => formatMoney(v))
        ];

        doc.autoTable({
            startY: currentY,
            head: [[{ content: 'RETENCIONES RENTA (VALOR RETENIDO)', colSpan: 14, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.1 } }],
                   tableHeaders],
            body: rentBody,
            foot: [rentFooter],
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, ...blackBorderStyles },
            headStyles: { fillColor: [22, 160, 233], textColor: 255, ...blackBorderStyles },
            footStyles: { ...footerStyles, ...blackBorderStyles },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 'auto' },
                ...Object.fromEntries(Array.from({length: 13}, (_, i) => [i+2, {halign: 'right', cellWidth: 15}]))
            },
            didDrawPage: (data: any) => currentY = data.cursor.y
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY + 50 > doc.internal.pageSize.height) { doc.addPage(); currentY = 15; }

        // ------------------------------------------
        // SECTION 4: RETENCIONES IVA (Valor Retenido)
        // ------------------------------------------
        const ivaConcepts = new Set<string>();
        atsDataList.forEach(m => m.retencionesIva.forEach(i => ivaConcepts.add(i.concepto)));
        const sortedIvaConcepts = Array.from(ivaConcepts).sort(); 

        const ivaBody: (string | number)[][] = [];
        const ivaTotals = Array(13).fill(0);

        sortedIvaConcepts.forEach(concept => {
            const row: (string | number)[] = ['', concept]; // No code for IVA
            let rowTotal = 0;

            for (let i = 1; i <= 12; i++) {
                const mData = getMonthData(i);
                if (mData) {
                    const ret = mData.retencionesIva.find(r => r.concepto === concept);
                    if (ret) {
                        row.push(formatMoney(ret.valRet));
                        rowTotal += ret.valRet;
                        ivaTotals[i-1] += ret.valRet;
                    } else {
                        row.push('-');
                    }
                } else {
                    row.push('-');
                }
            }
            row.push(formatMoney(rowTotal));
            ivaTotals[12] += rowTotal;
            ivaBody.push(row);
        });

        const ivaFooter = [
            { content: 'TOTAL', colSpan: 2, styles: { halign: 'right' } },
            ...ivaTotals.map(v => formatMoney(v))
        ];

        doc.autoTable({
            startY: currentY,
            head: [[{ content: 'RETENCIONES IVA (VALOR RETENIDO)', colSpan: 14, styles: { halign: 'center', fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.1 } }],
                   ['', 'Concepto', ...monthHeaders, 'TOTAL']],
            body: ivaBody,
            foot: [ivaFooter],
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, ...blackBorderStyles },
            headStyles: { fillColor: [22, 160, 233], textColor: 255, ...blackBorderStyles },
            footStyles: { ...footerStyles, ...blackBorderStyles },
            columnStyles: {
                0: { cellWidth: 2, halign: 'center' }, // Tiny column for "Code" placeholder
                1: { cellWidth: 'auto' },
                ...Object.fromEntries(Array.from({length: 13}, (_, i) => [i+2, {halign: 'right', cellWidth: 15}]))
            }
        });

        doc.save(`Talon_ATS_Anual_Consolidado_${new Date().getTime()}.pdf`);
    };


    return (
        <div className="w-full max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden mb-10">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-sri-blue dark:text-sri-gold">Talón Resumen ATS</h2>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Toggle Semestral */}
                    <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                        <input 
                            type="checkbox" 
                            id="semestral-mode" 
                            checked={isSemestral} 
                            onChange={toggleMode}
                            className="w-4 h-4 text-sri-blue rounded focus:ring-sri-blue border-gray-300"
                        />
                        <label htmlFor="semestral-mode" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            Semestral
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Botón Reporte Anual Matriz */}
                        {atsDataList.length > 0 && (
                            <button 
                                onClick={handleExportAnnualMatrixPdf} 
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 bg-green-600 text-white hover:bg-opacity-90"
                                title="Generar reporte anual consolidado (Matriz)"
                            >
                                <FileSpreadsheetIcon className="w-5 h-5 mr-2" /> 
                                <span className="hidden sm:inline">Reporte Anual</span>
                            </button>
                        )}
                         {atsDataList.length > 0 && (
                            <button 
                                onClick={handleExportPdf} 
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue bg-sri-blue text-white hover:bg-opacity-90"
                            >
                                <FileTextIcon className="w-5 h-5 mr-2" /> 
                                <span className="hidden sm:inline">PDF por Mes</span>
                            </button>
                        )}
                        {atsDataList.length > 0 && (
                            <button onClick={handleClear} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">
                                <TrashIcon className="w-5 h-5" /> 
                                <span className="hidden sm:inline ml-2">Limpiar</span>
                            </button>
                        )}
                        <div className="relative">
                            <label className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue-light ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-sri-blue-light text-white hover:bg-opacity-90'}`}>
                                {isProcessing ? <LoaderIcon className="w-5 h-5 mr-2 animate-spin" /> : <UploadIcon className="w-5 h-5 mr-2" />}
                                Cargar XML ATS
                            </label>
                            <input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                accept=".xml" 
                                onChange={handleFileUpload} 
                                disabled={isProcessing}
                                multiple // Allow selecting multiple files
                            />
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
                    <AlertTriangleIcon className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
                </div>
            )}

            {atsDataList.length === 0 && !isProcessing && (
                <div className="text-center py-20 px-6">
                    <FileCodeIcon className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Cargue sus archivos ATS (.xml)</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {isSemestral 
                            ? "Modo Semestral: Cargue los XML del mes 06 y 12."
                            : "Modo Mensual: Puede cargar múltiples archivos XML mensuales a la vez."}
                    </p>
                </div>
            )}

            {atsDataList.length > 0 && (
                <>
                    {/* Navigation Tabs */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <nav className="-mb-px flex space-x-4 px-4 overflow-x-auto" aria-label="Tabs">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`${
                                        activeTab === tab.id
                                            ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                                    } ${tab.id === 'TOTAL' ? 'font-bold' : 'font-medium'} flex-shrink-0 whitespace-nowrap py-4 px-2 border-b-2 text-sm transition-colors`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Display Data for Active Tab */}
                    {consolidatedData && (
                        <div className="p-6 space-y-8 bg-white dark:bg-gray-800 animate-fadeIn">
                            {/* Header Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">RAZÓN SOCIAL</p>
                                    <p className="text-lg font-bold text-sri-blue dark:text-white">{consolidatedData.razonSocial}</p>
                                </div>
                                <div className="flex flex-col md:items-end">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">RUC: <span className="text-gray-900 dark:text-white font-normal">{consolidatedData.ruc}</span></p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">PERIODO: <span className="text-gray-900 dark:text-white font-normal uppercase">{consolidatedData.periodoLabel}</span></p>
                                </div>
                            </div>

                            {/* Table 1: Compras */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600 text-center font-bold text-gray-700 dark:text-gray-200 uppercase text-sm">
                                    COMPRAS
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                        <thead className="bg-white dark:bg-gray-800">
                                            <tr>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">Cod.</th>
                                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">Transacción</th>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">No. Registros</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">BI Tarifa 0%</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">BI Tarifa 12%/15%</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">BI No Objeto IVA</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valor IVA</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                            {consolidatedData.compras.map((row) => (
                                                <tr key={row.cod} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-3 py-2 text-center text-xs font-mono text-gray-500 dark:text-gray-400 border-r dark:border-gray-600">{row.cod}</td>
                                                    <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-white border-r dark:border-gray-600">{row.transaccion}</td>
                                                    <td className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 border-r dark:border-gray-600">{row.count}</td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(row.bi0)}</td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(row.bi12)}</td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(row.biNoObj)}</td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white">{formatMoney(row.montoIva)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 dark:bg-gray-700 font-bold border-t-2 border-gray-300 dark:border-gray-500">
                                                <td colSpan={3} className="px-3 py-2 text-right text-xs text-gray-700 dark:text-white uppercase border-r dark:border-gray-600">TOTAL:</td>
                                                <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(consolidatedData.totals.compras.bi0)}</td>
                                                <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(consolidatedData.totals.compras.bi12)}</td>
                                                <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(consolidatedData.totals.compras.biNoObj)}</td>
                                                <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white">{formatMoney(consolidatedData.totals.compras.montoIva)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="text-center font-bold text-sri-blue dark:text-sri-gold uppercase text-sm py-2 border-b-2 border-sri-blue dark:border-sri-gold">
                                RESUMEN DE RETENCIONES - AGENTE DE RETENCIÓN
                            </div>

                            {/* Table 2: Retenciones Renta */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600 text-center font-bold text-gray-700 dark:text-gray-200 uppercase text-sm text-sri-blue-light">
                                    RETENCIÓN EN LA FUENTE DE IMPUESTO A LA RENTA
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                        <thead className="bg-white dark:bg-gray-800">
                                            <tr>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600 w-16">Cod.</th>
                                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600">Concepto de Retención</th>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600 w-24">No. Registros</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600 w-32">Base Imponible</th>
                                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Valor Retenido</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                            {consolidatedData.retencionesRenta.map((row) => (
                                                <tr key={row.cod} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-3 py-2 text-center text-xs font-mono text-gray-500 dark:text-gray-400 border-r dark:border-gray-600">{row.cod}</td>
                                                    <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-white border-r dark:border-gray-600">{row.concepto}</td>
                                                    <td className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400 border-r dark:border-gray-600">{row.count}</td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(row.base)}</td>
                                                    <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white">{formatMoney(row.valRet)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 dark:bg-gray-700 font-bold border-t-2 border-gray-300 dark:border-gray-500">
                                                <td colSpan={3} className="px-3 py-2 text-right text-xs text-gray-700 dark:text-white uppercase border-r dark:border-gray-600">TOTAL:</td>
                                                <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white border-r dark:border-gray-600">{formatMoney(consolidatedData.totals.retRenta.base)}</td>
                                                <td className="px-3 py-2 text-right text-xs font-mono text-gray-900 dark:text-white">{formatMoney(consolidatedData.totals.retRenta.valRet)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Table 3: Retenciones IVA */}
                            <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-300 dark:border-gray-600 text-center font-bold text-gray-700 dark:text-gray-200 uppercase text-sm text-sri-blue-light">
                                    RETENCIÓN EN LA FUENTE DE IVA
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                                        <thead className="bg-white dark:bg-gray-800">
                                            <tr>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600 w-1/4">Operación</th>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r dark:border-gray-600 w-1/2">Concepto de Retención</th>
                                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/4">Valor Retenido</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                            {consolidatedData.retencionesIva.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-3 py-2 text-center text-xs text-gray-900 dark:text-white border-r dark:border-gray-600">{row.operacion}</td>
                                                    <td className="px-3 py-2 text-center text-xs text-gray-900 dark:text-white border-r dark:border-gray-600">{row.concepto}</td>
                                                    <td className="px-3 py-2 text-center text-xs font-mono text-gray-900 dark:text-white">{formatMoney(row.valRet)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 dark:bg-gray-700 font-bold border-t-2 border-gray-300 dark:border-gray-500">
                                                <td colSpan={2} className="px-3 py-2 text-right text-xs text-gray-700 dark:text-white uppercase border-r dark:border-gray-600">TOTAL:</td>
                                                <td className="px-3 py-2 text-center text-xs font-mono text-gray-900 dark:text-white">{formatMoney(consolidatedData.totals.retIva)}</td>
                                            </tr>
                                            <tr className="bg-sri-gold/20 dark:bg-sri-gold/10 font-bold border-t border-sri-gold">
                                                <td colSpan={2} className="px-3 py-2 text-left text-xs text-gray-900 dark:text-white uppercase border-r border-sri-gold/50">TOTAL IMPUESTO A PAGAR POR RETENCIÓN (Renta + IVA)</td>
                                                <td className="px-3 py-2 text-center text-xs font-mono text-gray-900 dark:text-white">{formatMoney(consolidatedData.totals.retRenta.valRet + consolidatedData.totals.retIva)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AtsSummary;
