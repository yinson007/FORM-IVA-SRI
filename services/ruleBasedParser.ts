
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

    // Expresión regular para encontrar casilleros (3 o 4 dígitos) y sus valores.
    // MODIFICADO: (\d{3,4}) para aceptar casilleros como 3120, 3620, etc.
    // --- NUEVA LÓGICA DE EXTRACCIÓN ROBUSTA ---
    const lines = text.split('\n');
    
    for (const line of lines) {
        // 1. Encontrar todos los posibles IDs de casilleros en esta línea (3-4 dígitos)
        const idMatches: { id: string, index: number, length: number }[] = [];
        const idRegex = /\b(\d{3,4})\b/g;
        let m;
        while ((m = idRegex.exec(line)) !== null) {
            idMatches.push({ id: m[1], index: m.index, length: m[0].length });
        }

        if (idMatches.length === 0) continue;
        
        console.log(`DEBUG: Procesando línea: "${line}" con IDs: ${idMatches.map(i => i.id).join(', ')}`);

        // 2. Encontrar todos los posibles valores numéricos en esta línea
        // Un valor es algo que parece un número (con o sin decimales)
        const valueMatches: { value: number, index: number, length: number, str: string }[] = [];
        // Regex para números: opcionalmente negativos, con miles/decimales (. o ,)
        const valueRegex = /-?[\d]+(?:[.,][\d]+)+|-?[\d]+/g;
        
        while ((m = valueRegex.exec(line)) !== null) {
            const valStr = m[0];
            const valIndex = m.index;
            
            // IMPORTANTE: Un número solo es un "valor" si NO es uno de los IDs que ya identificamos
            // Comparamos índices para estar seguros
            const isId = idMatches.some(idM => idM.index === valIndex && idM.length === valStr.length);
            if (isId) continue;

            const value = cleanAndParseValue(valStr);
            valueMatches.push({ value, index: valIndex, length: valStr.length, str: valStr });
        }

        // 3. Lógica de Emparejamiento (Pairing)
        if (valueMatches.length > 0) {
            // Caso A: Formato Agrupado (ID1 ID2 ID3 ... Valor1 Valor2 Valor3 ...)
            // Común en tablas de SRI donde los códigos están a la izquierda y valores a la derecha
            const maxIdIndex = Math.max(...idMatches.map(i => i.index));
            const minValueIndex = Math.min(...valueMatches.map(v => v.index));
            
            if (maxIdIndex < minValueIndex && idMatches.length === valueMatches.length) {
                for (let i = 0; i < idMatches.length; i++) {
                    const id = idMatches[i].id;
                    const val = valueMatches[i].value;

                    // AJUSTE: No extraer valores para 799 y 800 directamente del PDF
                    if (id === "799" || id === "800") {
                        console.log(`DEBUG: Omitiendo extracción directa de casillero ${id} (formato agrupado)`);
                        continue;
                    }

                    // Solo guardamos si no tenemos un valor mejor (distinto de cero)
                    if (dataMap[id] === undefined || dataMap[id] === 0) {
                        dataMap[id] = val;
                    }
                }
            } 
            // Caso B: Formato Intercalado (ID1 Valor1 ID2 Valor2 ...)
            // O casos mixtos
            else {
                for (let i = 0; i < idMatches.length; i++) {
                    const currentId = idMatches[i];
                    const nextId = idMatches[i + 1];
                    
                    // Buscamos valores que estén DESPUÉS de este ID pero ANTES del siguiente ID
                    // Y que estén muy cerca del ID (máximo 15 caracteres de distancia)
                    const valuesForThisId = valueMatches.filter(v => 
                        v.index > currentId.index && 
                        v.index < currentId.index + currentId.length + 15 && 
                        (!nextId || v.index < nextId.index)
                    );
                    
                    if (valuesForThisId.length > 0) {
                        const id = currentId.id;
                        
                        // AJUSTE: No extraer valores para 799 y 800 directamente del PDF
                        if (id === "799" || id === "800") {
                            console.log(`DEBUG: Omitiendo extracción directa de casillero ${id}`);
                            continue;
                        }

                        // Si hay varios valores, tomamos el primero (el más cercano al ID)
                        // A menos que el primero sea igual al ID (error de duplicación en PDF)
                        let selectedValue = valuesForThisId[0].value;
                        
                        // Si el valor es igual al ID, intentamos tomar el siguiente si existe
                        if (Math.abs(selectedValue - parseFloat(currentId.id)) < 0.001 && valuesForThisId.length > 1) {
                            selectedValue = valuesForThisId[1].value;
                        }

                        console.log(`DEBUG: Casillero ${currentId.id} emparejado con valor ${selectedValue} (de valores: ${valuesForThisId.map(v => v.value).join(', ')})`);

                        if (dataMap[id] === undefined || dataMap[id] === 0) {
                            dataMap[id] = selectedValue;
                        }
                    }
                }
            }
        }
    }
    // --- FIN DE LÓGICA DE EXTRACCIÓN ---

    // AJUSTE: Calcular casillero 799 como suma de 721+723+725+727+729+731
    const idsToSum = ["721", "723", "725", "727", "729", "731"];
    const sum799 = idsToSum.reduce((acc, id) => acc + (dataMap[id] || 0), 0);
    dataMap["799"] = sum799;
    console.log(`DEBUG: Valor calculado para casillero 799: ${sum799} (Suma de ${idsToSum.join('+')})`);
    
    // Asegurar que 800 sea 0 si no se extrae (o dejarlo como undefined si se prefiere, pero el usuario pidió no extraerlo)
    dataMap["800"] = dataMap["800"] || 0;
    
    // Regex para encontrar el período fiscal - Mejorado
    const periodoRegex = /(?:PER[ÍI]ODO|MES|A[ÑN]O|FISCAL)\s*[:\-]?\s*((?:ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})|(?:PRIMER|SEGUNDO)\s+SEMESTRE\s+(\d{4})|(?:\d{2})\/(?:\d{4}))/i;
    const periodoMatch = text.match(periodoRegex);
    const periodo = periodoMatch ? periodoMatch[1].toUpperCase() : '';

    // Regex para encontrar el tipo de declaración
    const tipoRegex = /(?:TIPO|DECLARACI[ÓO]N)\s*[:\-]?\s*(ORIGINAL|SUSTITUTIVA)/i;
    const tipoMatch = text.match(tipoRegex);
    const tipo = tipoMatch ? tipoMatch[1].toUpperCase() : '';

    // Regex to find Identification (RUC) - Mejorado para ser más flexible
    const identificacionRegex = /(?:IDENTIFICACI[ÓO]N(?: DEL SUJETO PASIVO)?|RUC|N[ÚU]MERO DE RUC)\s*[:\-]?\s*(\d{13})/i;
    const identificacionMatch = text.match(identificacionRegex);
    const identificacion = identificacionMatch ? identificacionMatch[1] : '';

    // Regex to find Razón Social (Business Name) - Mejorado
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
