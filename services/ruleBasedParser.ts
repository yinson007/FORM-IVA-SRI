
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
    // Expresión regular mejorada para encontrar casilleros (3 o 4 dígitos) y sus valores.
    // Se busca un ID de 3-4 dígitos seguido de un valor numérico.
    // Se intenta evitar que el ID sea capturado como valor si se repite.
    // Usamos el texto completo para permitir capturas que podrían estar en líneas separadas por poco espacio.
    
    // Regex que busca: [Opcional: Casillero/Campo] [ID de 3-4 dígitos] [Opcional: : o -] [Espacios/Salto de línea] [Valor numérico]
    const casilleroValueRegex = /(?:Casillero|Campo|ID)?\s*(\d{3,4})\s*[:\-]?\s+(-?[\d.,]+)(?=\s|$)/gi;
    let match;
    
    while ((match = casilleroValueRegex.exec(text)) !== null) {
        const id = match[1];
        const valueStr = match[2];
        
        // Validar si el ID es uno de los que esperamos (3 o 4 dígitos)
        if (id.length < 3 || id.length > 4) continue;

        const value = cleanAndParseValue(valueStr);

        // MEJORA: Si el valor es exactamente igual al ID (ej: Casillero 731, Valor 731.00)
        // es muy probable que sea una repetición del ID en el PDF.
        if (Math.abs(value - parseFloat(id)) < 0.001) {
            // Intentamos ver si hay otro número después en el texto cercano
            const searchRange = text.substring(match.index + match[0].length, match.index + match[0].length + 20).trim();
            const nextValueMatch = /^(-?[\d.,]+)/.exec(searchRange);
            if (nextValueMatch) {
                const nextValue = cleanAndParseValue(nextValueMatch[1]);
                dataMap[id] = nextValue;
                continue; 
            }
            continue;
        }

        // Guardar el valor si no existe o si el actual es 0 (dando prioridad a valores reales)
        if (dataMap[id] === undefined || dataMap[id] === 0) {
            dataMap[id] = value;
        }
    }
    
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
