
export interface ExtractedData {
  data: Record<string, number>;
  periodo: string;
  tipo: string;
  identificacion: string;
  razonSocial: string;
}

/**
 * Normaliza y convierte un string de valor monetario a un número de forma robusta,
 * manejando diversos formatos con '.' y ',' como separadores.
 * @param valueStr El string a limpiar.
 * @returns El valor numérico, o 0 si no es válido.
 */
function cleanAndParseValue(valueStr: string): number {
  // 1. Limpiar el string de espacios en blanco
  const s = String(valueStr).trim().replace(/\s/g, '');
  if (s === '') return 0;

  const commaCount = (s.match(/,/g) || []).length;
  const periodCount = (s.match(/\./g) || []).length;
  let numberString: string;

  // 2. Casos con solo comas
  if (commaCount > 0 && periodCount === 0) {
    const parts = s.split(',');
    // Heurística: si la última parte tiene 3 dígitos y hay más de una parte,
    // es probable que sea un separador de miles (ej: 1,000).
    // De lo contrario, es un separador decimal (ej: 1,23).
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      numberString = s.replace(/,/g, '');
    } else {
      numberString = s.replace(',', '.');
    }
  }
  // 3. Casos con solo puntos
  else if (periodCount > 0 && commaCount === 0) {
    const parts = s.split('.');
    // Heurística: Si hay más de un punto, son separadores de miles (1.234.567).
    // O, si hay un solo punto y la parte DESPUÉS tiene 3 dígitos, es probable
    // que sea un separador de miles (ej: 1.234, 12.345, 123.456).
    // Esto distingue "1.234" (mil) de "1234.56" (decimal).
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
       numberString = s.replace(/\./g, '');
    } else {
      // De lo contrario, se trata como un decimal (123.45, 1234.56)
      numberString = s;
    }
  }
  // 4. Casos con ambos separadores
  else if (commaCount > 0 && periodCount > 0) {
    // El último separador que aparece es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato: 1.234,56 -> "1234.56"
      numberString = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato: 1,234.56 -> "1234.56"
      numberString = s.replace(/,/g, '');
    }
  }
  // 5. Sin separadores
  else {
    numberString = s;
  }

  const result = parseFloat(numberString);
  return isNaN(result) ? 0 : result;
}


/**
 * Extrae datos de un formulario de impuestos usando reglas y expresiones regulares.
 * @param text El texto completo extraído de un archivo PDF.
 * @returns Una promesa que resuelve a un objeto con los datos extraídos.
 */
export async function extractDataWithRules(text: string): Promise<ExtractedData> {
  return new Promise((resolve) => {
    const dataMap: Record<string, number> = {};

    // 0. Identificar y excluir líneas de fórmulas informativas (ej: (411+412+420+435+415+416+417+418) / 419)
    const lines = text.split('\n');
    const formulaRanges: { start: number, end: number }[] = [];
    let tempPos = 0;
    for (const line of lines) {
        // Si la línea parece una fórmula (paréntesis, signos más, división y varios números de casilleros)
        if (line.includes('(') && line.includes('+') && line.includes('/') && (line.match(/\b\d{3,4}\b/g)?.length || 0) > 3) {
            formulaRanges.push({ start: tempPos, end: tempPos + line.length });
        }
        tempPos += line.length + 1;
    }

    const isInsideFormula = (index: number) => formulaRanges.some(r => index >= r.start && index <= r.end);

    // 1. Extraer todos los IDs de casilleros (3 o 4 dígitos) con sus posiciones, ignorando fórmulas
    const allIds: { id: string, index: number, length: number }[] = [];
    const idRegex = /\b(\d{3,4})\b/g;
    let m;
    while ((m = idRegex.exec(text)) !== null) {
        if (!isInsideFormula(m.index)) {
            allIds.push({ id: m[1], index: m.index, length: m[0].length });
        }
    }

    // 2. Extraer todos los posibles valores numéricos con sus posiciones, ignorando fórmulas
    const allValues: { value: number, index: number, length: number, str: string }[] = [];
    const valueRegex = /-?[\d]+(?:[.,][\d]+)+|-?[\d]+/g;
    while ((m = valueRegex.exec(text)) !== null) {
        if (!isInsideFormula(m.index)) {
            const valStr = m[0];
            const valIndex = m.index;
            
            // Un número solo es un "valor" si NO es uno de los IDs que ya identificamos
            const isId = allIds.some(idM => idM.index === valIndex && idM.length === valStr.length);
            if (isId) continue;

            const value = cleanAndParseValue(valStr);
            allValues.push({ value, index: valIndex, length: valStr.length, str: valStr });
        }
    }

    // 3. Lógica de Emparejamiento por Líneas (Más precisa para la mayoría de PDFs del SRI)
    let currentPos = 0;
    
    for (const line of lines) {
        const lineStart = currentPos;
        const lineEnd = currentPos + line.length;
        
        const idsInLine = allIds.filter(id => id.index >= lineStart && id.index < lineEnd);
        const valuesInLine = allValues.filter(v => v.index >= lineStart && v.index < lineEnd);
        
        if (idsInLine.length > 0 && valuesInLine.length > 0) {
            // Caso A: Formato Agrupado en la misma línea (ID1 ID2 ... Valor1 Valor2 ...)
            const maxIdIndex = Math.max(...idsInLine.map(i => i.index));
            const minValueIndex = Math.min(...valuesInLine.map(v => v.index));
            
            if (maxIdIndex < minValueIndex && idsInLine.length === valuesInLine.length) {
                for (let i = 0; i < idsInLine.length; i++) {
                    const id = idsInLine[i].id;
                    if (id === "799" || id === "800") continue;
                    if (dataMap[id] === undefined || dataMap[id] === 0) {
                        dataMap[id] = valuesInLine[i].value;
                    }
                }
            } 
            // Caso B: Formato Intercalado o Cercano en la misma línea
            else {
                for (let i = 0; i < idsInLine.length; i++) {
                    const currentId = idsInLine[i];
                    const nextId = idsInLine[i + 1];
                    
                    // Buscamos valores que estén DESPUÉS de este ID pero antes del siguiente
                    // Aumentamos la tolerancia a 60 caracteres para casos de mucho espacio
                    const valuesForThisId = valuesInLine.filter(v => 
                        v.index > currentId.index && 
                        v.index < currentId.index + currentId.length + 60 && 
                        (!nextId || v.index < nextId.index)
                    );
                    
                    if (valuesForThisId.length > 0) {
                        const id = currentId.id;
                        if (id === "799" || id === "800") continue;
                        
                        let selectedValue = valuesForThisId[0].value;
                        // Si el valor es igual al ID (error común), intentar el siguiente
                        if (Math.abs(selectedValue - parseFloat(id)) < 0.001 && valuesForThisId.length > 1) {
                            selectedValue = valuesForThisId[1].value;
                        }

                        if (dataMap[id] === undefined || dataMap[id] === 0) {
                            dataMap[id] = selectedValue;
                        }
                    }
                }
            }
        }
        currentPos = lineEnd + 1; // +1 por el \n
    }

    // 4. Lógica de Respaldo: Emparejamiento Global para casilleros faltantes
    // Si un casillero fue encontrado pero no tiene valor, buscar el valor más cercano en todo el texto
    allIds.forEach(idObj => {
        const id = idObj.id;
        if (id === "799" || id === "800") return;
        if (dataMap[id] === undefined || dataMap[id] === 0) {
            // Buscar el valor más cercano que aparezca DESPUÉS del ID (máximo 100 caracteres)
            const closestValue = allValues.find(v => 
                v.index > idObj.index && 
                v.index < idObj.index + idObj.length + 100
            );
            if (closestValue) {
                dataMap[id] = closestValue.value;
            }
        }
    });

    // AJUSTE: Calcular casillero 799 como suma de 721+723+725+727+729+731
    const idsToSum = ["721", "723", "725", "727", "729", "731"];
    const sum799 = idsToSum.reduce((acc, id) => acc + (dataMap[id] || 0), 0);
    dataMap["799"] = sum799;
    
    // Asegurar que 800 sea 0
    dataMap["800"] = 0;
    
    // Normalización del Período
    const monthMap: Record<string, string> = {
        '01': 'ENERO', '02': 'FEBRERO', '03': 'MARZO', '04': 'ABRIL',
        '05': 'MAYO', '06': 'JUNIO', '07': 'JULIO', '08': 'AGOSTO',
        '09': 'SEPTIEMBRE', '10': 'OCTUBRE', '11': 'NOVIEMBRE', '12': 'DICIEMBRE'
    };

    // Regex para encontrar el período fiscal - Mejorado y más flexible
    const periodoRegex = /(?:PER[ÍI]ODO|MES|A[ÑN]O|FISCAL)\s*[:\-]?\s*((?:ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*[-/]?\s*(\d{4})|(?:PRIMER|SEGUNDO)\s+SEMESTRE\s+(\d{4})|(\d{2})\s*[\/-]\s*(\d{4}))/i;
    const periodoMatch = text.match(periodoRegex);
    let periodo = '';
    
    if (periodoMatch) {
        if (periodoMatch[4] && periodoMatch[5]) {
            // Formato MM/YYYY o MM-YYYY
            const m = periodoMatch[4];
            const y = periodoMatch[5];
            periodo = `${monthMap[m] || m} ${y}`;
        } else {
            // Formato NOMBRE_MES YYYY
            periodo = periodoMatch[1].toUpperCase().replace(/\s*[-/]\s*/, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    // Si no se encontró con el regex principal, buscar cualquier mes y año cercano
    if (!periodo) {
        const fallbackRegex = /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*(\d{4})/i;
        const fallbackMatch = text.match(fallbackRegex);
        if (fallbackMatch) {
            periodo = `${fallbackMatch[1].toUpperCase()} ${fallbackMatch[2]}`;
        }
    }

    // Regex para encontrar el tipo de declaración
    const tipoRegex = /(?:TIPO|DECLARACI[ÓO]N)\s*[:\-]?\s*(ORIGINAL|SUSTITUTIVA)/i;
    const tipoMatch = text.match(tipoRegex);
    const tipo = tipoMatch ? tipoMatch[1].toUpperCase() : '';

    // Regex to find Identification (RUC)
    const identificacionRegex = /(?:IDENTIFICACI[ÓO]N(?: DEL SUJETO PASIVO)?|RUC|N[ÚU]MERO DE RUC)\s*[:\-]?\s*(\d{13})/i;
    const identificacionMatch = text.match(identificacionRegex);
    const identificacion = identificacionMatch ? identificacionMatch[1] : '';

    // Regex to find Razón Social
    const razonSocialRegex = /(?:RAZ[ÓO]N SOCIAL(?: O APELLIDOS Y NOMBRES COMPLETOS)?|SUJETO PASIVO)\s*[:\-]?\s*([A-ZÑ\sÁÉÍÓÚÜ]+?)(?:\s+\d{3}|\s+RUC|\s+IDENTIFICACI[ÓO]N|$|\n)/i;
    const razonSocialMatch = text.match(razonSocialRegex);
    const razonSocial = razonSocialMatch ? razonSocialMatch[1].trim() : '';

    resolve({
      data: dataMap,
      periodo,
      tipo,
      identificacion,
      razonSocial,
    });
  });
}
