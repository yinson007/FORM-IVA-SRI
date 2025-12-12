
import React, { useState } from 'react';
import TaxForm from './components/TaxForm';
import AnnualReport from './components/AnnualReport';
import WithholdingForm from './components/WithholdingForm';
import AtsSummary from './components/AtsSummary';
import { ClipboardListIcon, FileTextIcon, FileSpreadsheetIcon, FileCodeIcon } from './components/icons';

const App: React.FC = () => {
    const [activeView, setActiveView] = useState<'declaration' | 'report' | 'withholding' | 'ats'>('declaration');

    const getTabClassName = (view: 'declaration' | 'report' | 'withholding' | 'ats') => {
        const baseClasses = "group inline-flex items-center justify-center py-3 px-4 border-b-2 font-medium text-base transition-colors duration-200 focus:outline-none";
        if (activeView === view) {
            return `${baseClasses} border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold`;
        }
        return `${baseClasses} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200`;
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <header className="text-center w-full mb-8">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-sri-blue dark:text-white tracking-tight">
                    TAXWO TOOL <span className="text-sri-blue-light dark:text-sri-gold">Asistente Fiscal SRI</span>
                </h1>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
                    Complete, verifique y genere reportes consolidados de sus declaraciones tributarias y Anexos por mes o Periodo Fiscal. 
                    <span className="block mt-1 font-medium text-sri-blue dark:text-sri-blue-light">
                        Audita tu situación tributaria, proyecta y planifica el pago de impuestos.
                    </span>
                </p>
            </header>

            <div className="w-full max-w-6xl mx-auto mb-6">
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-6 justify-center overflow-x-auto" aria-label="Tabs">
                        <button
                            onClick={() => setActiveView('declaration')}
                            className={getTabClassName('declaration')}
                        >
                            <FileTextIcon className="w-5 h-5 mr-2" />
                            <span className="whitespace-nowrap">Declaración IVA</span>
                        </button>
                        <button
                            onClick={() => setActiveView('report')}
                            className={getTabClassName('report')}
                        >
                            <ClipboardListIcon className="w-5 h-5 mr-2" />
                            <span className="whitespace-nowrap">Reporte Formulario IVA</span>
                        </button>
                        <button
                            onClick={() => setActiveView('withholding')}
                            className={getTabClassName('withholding')}
                        >
                            <FileSpreadsheetIcon className="w-5 h-5 mr-2" />
                            <span className="whitespace-nowrap">Formulario Retenciones</span>
                        </button>
                        <button
                            onClick={() => setActiveView('ats')}
                            className={getTabClassName('ats')}
                        >
                            <FileCodeIcon className="w-5 h-5 mr-2" />
                            <span className="whitespace-nowrap">Talon ATS</span>
                        </button>
                    </nav>
                </div>
            </div>
            
            <div className="w-full flex-grow">
                {activeView === 'declaration' && <TaxForm />}
                {activeView === 'report' && <AnnualReport />}
                {activeView === 'withholding' && <WithholdingForm />}
                {activeView === 'ats' && <AtsSummary />}
            </div>

            <footer className="text-center mt-12 pb-6 text-sm text-gray-500 dark:text-gray-400">
                <p>&copy; {new Date().getFullYear()} TAXWO TOOL. Soluciones Fiscales para Ecuador.</p>
            </footer>
        </div>
    );
};

export default App;
