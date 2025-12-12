
import React, { useState } from 'react';
import { formStructure, FormRow, FormField, FormSection, casilleroToConcepto } from '../data/formStructure';
import { PlusIcon, MinusIcon, UploadIcon, LoaderIcon, AlertTriangleIcon, FileTextIcon, FileCodeIcon } from './icons';
import { parsePdfText } from '../services/pdfParser';
import { extractDataWithRules, ExtractedData } from '../services/ruleBasedParser';

// Declarations for jsPDF libraries loaded from CDN
declare const jspdf: any;

interface jsPDFWithAutoTable {
  autoTable: (options: any) => jsPDFWithAutoTable;
  setFontSize(size: number): jsPDFWithAutoTable;
  setTextColor(r: number, g?: number, b?: number): jsPDFWithAutoTable;
  text(text: string | string[], x: number, y: number, options?: any): jsPDFWithAutoTable;
  save(filename: string): void;
  [key: string]: any;
}


const TaxForm: React.FC = () => {
    const TABS = [
        { range: "400", label: "Casilleros 400" },
        { range: "500", label: "Casilleros 500" },
        { range: "600", label: "Casilleros 600" },
        { range: "700", label: "Casilleros 700" },
        { range: "800", label: "Casilleros 800 y 900" },
    ];
    const [activeTab, setActiveTab] = useState(TABS[0].range);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [identificacion, setIdentificacion] = useState<string>('');
    const [razonSocial, setRazonSocial] = useState<string>('');
    const [periodo, setPeriodo] = useState<string>('');
    const [tipoDeclaracion, setTipoDeclaracion] = useState<string>('ORIGINAL');

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        'RESUMEN DE VENTAS Y OTRAS OPERACIONES DEL PERIODO QUE DECLARA': true,
        'LIQUIDACIÓN DEL IVA EN EL MES': true,
        'RESUMEN DE ADQUISICIONES Y PAGOS DEL PERÍODO QUE DECLARA': true,
        'RESUMEN IMPOSITIVO: AGENTE DE PERCEPCIÓN DEL IMPUESTO AL VALOR AGREGADO': true,
        'IMPUESTO A LA SALIDA DE DIVISAS A EFECTOS DE DEVOLUCIÓN A EXPORTADORES HABITUALES DE BIENES': true,
        'AGENTE DE RETENCIÓN DEL IMPUESTO AL VALOR AGREGADO': true,
        'Detalle de imputación al pago (para declaraciones sustitutivas)': true,
        'Pago diferido IVA por emergencia sanitaria COVID-19': true,
        'Valores a Pagar (luego de imputación)': true,
    });
    const [isProcessingPdf, setIsProcessingPdf] = useState<boolean>(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

    const toggleSection = (description: string) => {
        setOpenSections(prev => ({ ...prev, [description]: !prev[description] }));
    };

    const handleInputChange = (id: string, value: string) => {
        setFormValues(prev => ({ ...prev, [id]: value }));
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessingPdf(true);
        setPdfError(null);

        try {
            const text: string = await parsePdfText(file);
            const extracted: ExtractedData = await extractDataWithRules(text);

            if (Object.keys(extracted.data).length === 0 && !extracted.identificacion) {
                 throw new Error("No se pudo extraer información relevante. Verifique que el archivo sea una declaración de IVA válida.");
            }

            const stringifiedData: Record<string, string> = {};
            for (const key in extracted.data) {
                stringifiedData[key] = String(extracted.data[key]);
            }
            
            setIdentificacion(extracted.identificacion || '');
            setRazonSocial(extracted.razonSocial || '');
            setPeriodo(extracted.periodo || '');
            setTipoDeclaracion(extracted.tipo ? extracted.tipo.toUpperCase() : 'ORIGINAL');
            setFormValues(stringifiedData);
            
        } catch (err: unknown) {
            if (err instanceof Error) {
                setPdfError(`Error al procesar el PDF: ${err.message}`);
            } else {
                setPdfError('Ocurrió un error desconocido.');
            }
        } finally {
            setIsProcessingPdf(false);
            event.target.value = ''; 
        }
    };

    const handleExportJson = () => {
        const detallesDeclaracion: Record<string, string> = {};

        // Recorrer los valores del formulario
        Object.entries(formValues).forEach(([casillero, valor]) => {
            const numVal = parseFloat(valor);
            const concepto = casilleroToConcepto[casillero];

            // Solo agregar si existe mapeo a concepto y el valor es mayor a 0 (según reglas del PDF)
            if (concepto && !isNaN(numVal) && numVal !== 0) {
                // Regla del PDF: "En caso de decimales, se deben registrar con punto (.)"
                detallesDeclaracion[concepto] = numVal.toFixed(2);
            }
        });

        // Estructura JSON sugerida por la guía (objeto anidado)
        const jsonOutput = {
            identificacionInformante: identificacion,
            razonSocial: razonSocial,
            periodo: periodo,
            tipoDeclaracion: tipoDeclaracion,
            detallesDeclaracion: detallesDeclaracion
        };

        const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `declaracion_iva_${identificacion || 'sin_id'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = () => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' }) as jsPDFWithAutoTable;

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text("Resumen de Declaración de IVA", 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);

        doc.text(`Identificación: ${identificacion || 'No especificado'}`, 14, 32);
        doc.text(`Razón Social: ${razonSocial || 'No especificado'}`, 14, 40);

        doc.text(`Período: ${periodo || 'No especificado'}`, 160, 32);
        doc.text(`Tipo: ${tipoDeclaracion}`, 160, 40);
        
        doc.text(`Exportado el: ${new Date().toLocaleDateString('es-EC')}`, 220, 22);


        let finalY = 50;

        formStructure.forEach((section: FormSection) => {
            const tableBody: (string | number)[][] = [];
            let currentHeaders: (FormField | null)[] = [];

            const sectionHasData = section.rows.some(row => 
                row.fields.some(field => field && parseFloat(formValues[field.id] || '0') > 0)
            );

            if (!sectionHasData) return;

            section.rows.forEach((row: FormRow) => {
                if (row.isHeader) {
                    currentHeaders = row.fields;
                    return;
                }
                if (row.isTitle || row.isAccordion || row.isHeader) return;

                const rowHasValue = row.fields.some(field => field && parseFloat(formValues[field.id] || '0') > 0);

                if (rowHasValue) {
                    const pdfRow: (string | number)[] = [row.description, '', '', '', '', '', ''];
                    
                    row.fields.forEach((field, fieldIndex) => {
                        if (field && parseFloat(formValues[field.id] || '0') > 0) {
                            const headerId = currentHeaders[fieldIndex]?.id || 'valorUnico';
                            
                            const casilleroColumnIndexMap: { [key: string]: number } = {
                                valorBruto: 1, valorNeto: 3, impuestoGenerado: 5, valorUnico: 5,
                                valor: 1, isd: 3, porcentaje: 5
                            };

                            const valueColumnIndexMap: { [key: string]: number } = {
                                valorBruto: 2, valorNeto: 4, impuestoGenerado: 6, valorUnico: 6,
                                valor: 2, isd: 4, porcentaje: 6
                            };
                            
                            const casilleroColumnIndex = casilleroColumnIndexMap[headerId];
                            const valueColumnIndex = valueColumnIndexMap[headerId];
                           
                            if (casilleroColumnIndex !== undefined && valueColumnIndex !== undefined) {
                                const value = parseFloat(formValues[field.id]);
                                const formattedValue = value.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                
                                if (pdfRow[casilleroColumnIndex] === '') {
                                    pdfRow[casilleroColumnIndex] = field.id;
                                    pdfRow[valueColumnIndex] = formattedValue;
                                } else {
                                    (pdfRow[casilleroColumnIndex] as string) += `\n${field.id}`;
                                    (pdfRow[valueColumnIndex] as string) += `\n${formattedValue}`;
                                }
                            }
                        }
                    });
                    tableBody.push(pdfRow);
                }
            });

            if (tableBody.length > 0) {
                 if (finalY + tableBody.length * 10 > 180) { // Estimate if it fits, add page if not
                    doc.addPage();
                    finalY = 20;
                }

                doc.autoTable({
                    startY: finalY,
                    head: [[
                        { 
                            content: section.title, 
                            colSpan: 7, 
                            styles: { fillColor: [0, 166, 251], textColor: 255, fontStyle: 'bold' } 
                        }
                    ]],
                    body: [
                        ['Descripción', 'Cas.', 'Valor Bruto', 'Cas.', 'Valor Neto', 'Cas.', 'Impuesto / Valor'],
                        ...tableBody
                    ],
                    theme: 'grid',
                    styles: { lineColor: [0, 0, 0], lineWidth: 0.1 },
                    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [0, 51, 102], lineColor: [0, 0, 0], lineWidth: 0.1 },
                    columnStyles: { 
                        0: { cellWidth: 'auto' },
                        1: { halign: 'center', cellWidth: 20 },
                        2: { halign: 'right', cellWidth: 35 },
                        3: { halign: 'center', cellWidth: 20 },
                        4: { halign: 'right', cellWidth: 35 },
                        5: { halign: 'center', cellWidth: 20 },
                        6: { halign: 'right', cellWidth: 35 }
                    },
                    didDrawPage: (data) => {
                        finalY = data.cursor?.y ?? finalY;
                    }
                });
                finalY = (doc as any).lastAutoTable.finalY + 10;
            }
        });

        doc.save(`declaracion_iva_${identificacion || 'sin_id'}_${Date.now()}.pdf`);
    };

    const renderField = (field: FormField | null) => {
        if (!field || !field.id) return <div className="h-10"></div>;

        const hasValue = parseFloat(formValues[field.id] || '0') > 0;
        const stepValue = field.id === '563' ? '0.0001' : '0.01';

        return (
            <div className="w-full">
                 <div className="flex justify-between items-center mb-1 md:hidden">
                    <label htmlFor={`casillero-${field.id}`} className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {field.description}
                    </label>
                 </div>
                 <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 dark:text-gray-400 text-sm font-semibold">
                        {field.id}
                    </span>
                    <input
                        type="number"
                        step={stepValue}
                        id={`casillero-${field.id}`}
                        value={formValues[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        placeholder="0.00"
                        className={`w-full pl-14 pr-2 py-1 text-right bg-gray-50 dark:bg-gray-700 border rounded-md shadow-sm focus:ring-sri-blue-light focus:border-sri-blue-light font-mono transition-colors text-gray-800 dark:text-gray-200 ${
                            hasValue
                                ? 'border-sri-blue-light ring-1 ring-sri-blue-light'
                                : 'border-gray-300 dark:border-gray-600'
                        }`}
                    />
                </div>
            </div>
        );
    };
    
    const renderFormBody = () => {
        const nodes: React.ReactNode[] = [];
        let isInsideClosedAccordion = false;
        let currentHeaders: (FormField | null)[] = [];

        const activeSection = formStructure.find(sec => sec.range === activeTab);
        if (!activeSection) return null;

        activeSection.rows.forEach((row, rowIndex) => {
            if (row.isAccordion) {
                const isOpen = openSections[row.description] ?? false;
                isInsideClosedAccordion = !isOpen;
                const accordionHeaderClass = isOpen
                    ? 'bg-sri-blue-light text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-sri-blue dark:text-sri-gold hover:bg-gray-300 dark:hover:bg-gray-600';
                nodes.push(
                    <div
                        key={`accordion-${rowIndex}`}
                        className={`${accordionHeaderClass} font-bold text-sm uppercase cursor-pointer select-none transition-colors duration-200 rounded-md`}
                        onClick={() => toggleSection(row.description)}
                    >
                        <div className="flex justify-between items-center px-4 py-3">
                            <span>{row.description}</span>
                            {isOpen ? <MinusIcon className="w-5 h-5 text-sri-gold" /> : <PlusIcon className="w-5 h-5" />}
                        </div>
                    </div>
                );
            } else if (row.isHeader) {
                currentHeaders = row.fields;
                nodes.push(
                    <div key={`header-${rowIndex}`} className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 mt-2">
                        <div className="md:col-span-6 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Descripción</div>
                        {currentHeaders.map((header, headerIndex) => (
                           <div key={headerIndex} className="md:col-span-2 text-center text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider w-40 mx-auto">
                                {header?.description}
                           </div>
                        ))}
                    </div>
                );
            } else if (row.isTitle) {
                isInsideClosedAccordion = false;
                nodes.push(
                     <div key={rowIndex} className="px-4 py-3 bg-sri-blue text-white font-bold text-sm uppercase rounded-md mt-4">
                        {row.description}
                    </div>
                 );
            } else {
                if (!isInsideClosedAccordion) {
                    const rowClass = row.isTotal ? "bg-sri-gold/20 dark:bg-sri-gold/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/50";
                    nodes.push(
                        <div key={rowIndex} className={`py-2 transition-colors duration-150 ${rowClass}`}>
                            <div className="md:grid md:grid-cols-12 md:gap-4 md:items-start">
                                <div className="md:col-span-6 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 align-top">
                                    <p className={row.isTotal ? 'font-bold' : ''}>{row.description}</p>
                                    {row.note && <p className="text-xs text-gray-400 italic mt-1">{row.note}</p>}
                                </div>
                                
                                <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-4 px-4 md:px-0">
                                {row.fields.map((field, fieldIndex) => (
                                    <div key={fieldIndex} className="flex justify-center items-start">
                                        {field && renderField({...field, description: currentHeaders[fieldIndex]?.description})}
                                        {!field && <div className="hidden md:block w-40 h-10"></div>}
                                    </div>
                                ))}
                                </div>
                            </div>
                        </div>
                    );
                }
            }
        });
        return nodes;
    };


    return (
        <div className="w-full max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-sri-blue dark:text-sri-gold">Formulario de Declaración de IVA</h2>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <label 
                            htmlFor="pdf-form-upload"
                            className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue-light ${isProcessingPdf ? 'bg-gray-400 cursor-not-allowed' : 'bg-sri-blue-light text-white hover:bg-opacity-90'}`}
                        >
                            {isProcessingPdf ? (
                                <>
                                    <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <UploadIcon className="w-5 h-5 mr-2" />
                                    Llenar desde PDF
                                </>
                            )}
                        </label>
                        <input 
                            id="pdf-form-upload" 
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            accept="application/pdf"
                            onChange={handleFileChange}
                            disabled={isProcessingPdf}
                        />
                    </div>
                    <button
                        onClick={handleExportJson}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 bg-green-600 text-white hover:bg-opacity-90"
                    >
                        <FileCodeIcon className="w-5 h-5 mr-2" />
                        Exportar JSON
                    </button>
                     <button
                        onClick={handleExportPdf}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sri-blue bg-sri-blue text-white hover:bg-opacity-90"
                    >
                        <FileTextIcon className="w-5 h-5 mr-2" />
                        Exportar a PDF
                    </button>
                </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="identificacion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identificación</label>
                        <input type="text" id="identificacion" maxLength={13} value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} placeholder="Ej: 1712104304001" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sri-blue-light focus:border-sri-blue-light" />
                    </div>
                    <div>
                        <label htmlFor="razon-social" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razón Social</label>
                        <input type="text" id="razon-social" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="Ej: RAMOS VIDAL ZOILO TOMAS" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sri-blue-light focus:border-sri-blue-light" />
                    </div>
                     <div>
                        <label htmlFor="periodo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Período Fiscal</label>
                        <input type="text" id="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ej: ENERO 2024" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sri-blue-light focus:border-sri-blue-light" />
                    </div>
                     <div>
                        <label htmlFor="tipo-declaracion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Declaración</label>
                        <select id="tipo-declaracion" value={tipoDeclaracion} onChange={(e) => setTipoDeclaracion(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sri-blue-light focus:border-sri-blue-light">
                            <option value="ORIGINAL">ORIGINAL</option>
                            <option value="SUSTITUTIVA">SUSTITUTIVA</option>
                        </select>
                    </div>
                </div>
            </div>

            {pdfError && (
                <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
                    <AlertTriangleIcon className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{pdfError}</p>
                    <button onClick={() => setPdfError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
                </div>
            )}

            <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-4 px-4 overflow-x-auto" aria-label="Tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.range}
                            onClick={() => setActiveTab(tab.range)}
                            className={`${
                                activeTab === tab.range
                                    ? 'border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                            } flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="p-4">
                 <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {renderFormBody()}
                 </div>
            </div>
        </div>
    );
};

export default TaxForm;
