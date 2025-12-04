
import React, { useState } from 'react';
import TaxForm from './components/TaxForm';
import AnnualReport from './components/AnnualReport';
import { ClipboardListIcon, FileTextIcon } from './components/icons';

const App: React.FC = () => {
    const [activeView, setActiveView] = useState<'declaration' | 'report'>('declaration');

    const getTabClassName = (view: 'declaration' | 'report') => {
        const baseClasses = "group inline-flex items-center justify-center py-3 px-4 border-b-2 font-medium text-base transition-colors duration-200 focus:outline-none";
        if (activeView === view) {
            return `${baseClasses} border-sri-blue-light text-sri-blue-light dark:border-sri-gold dark:text-sri-gold`;
        }
        return `${baseClasses} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200`;
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <header className="text-center w-full mb-4">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-sri-blue dark:text-white">
                    Asistente Fiscal SRI
                </h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                    Complete, verifique y genere reportes de su declaración de IVA de manera sencilla.
                </p>
            </header>

            <div className="w-full max-w-6xl mx-auto mb-6">
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-6 justify-center" aria-label="Tabs">
                        <button
                            onClick={() => setActiveView('declaration')}
                            className={getTabClassName('declaration')}
                        >
                            <FileTextIcon className="w-5 h-5 mr-2" />
                            <span>Declaración IVA</span>
                        </button>
                        <button
                            onClick={() => setActiveView('report')}
                            className={getTabClassName('report')}
                        >
                            <ClipboardListIcon className="w-5 h-5 mr-2" />
                            <span>Reporte Formulario IVA</span>
                        </button>
                    </nav>
                </div>
            </div>
            
            <div className="w-full flex-grow">
                {activeView === 'declaration' && <TaxForm />}
                {activeView === 'report' && <AnnualReport />}
            </div>

            <footer className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
                <p>&copy; {new Date().getFullYear()} Soluciones Fiscales. Creado con React.</p>
            </footer>
        </div>
    );
};

export default App;