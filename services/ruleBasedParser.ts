
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
    const lines = text.split('\n');
    const casilleroValueRegex = /(\d{3,4})\s+(-?[\d.,]+)/g;

    for (const line of lines) {
        // Busca pares directos de casillero-valor en una línea
        let match;
        while ((match = casilleroValueRegex.exec(line)) !== null) {
            const id = match[1];
            const valueStr = match[2];
            const value = cleanAndParseValue(valueStr);

            if (!isNaN(value) && value !== 0) {
                 // Evita sobrescribir valores ya encontrados, asumiendo que el primero es el correcto
                if (!dataMap[id]) {
                    dataMap[id] = value;
                }
            }
        }
    }
    
    // Regex para encontrar el período fiscal
    const periodoRegex = /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})|(PRIMER|SEGUNDO)\s+SEMESTRE\s+(\d{4})/i;
    const periodoMatch = text.match(periodoRegex);
    const periodo = periodoMatch ? periodoMatch[0].toUpperCase() : '';

    // Regex para encontrar el tipo de declaración
    const tipoRegex = /(ORIGINAL|SUSTITUTIVA)/i;
    const tipoMatch = text.match(tipoRegex);
    const tipo = tipoMatch ? tipoMatch[0].toUpperCase() : '';

    // Regex to find Identification (RUC)
    const identificacionRegex = /(?:IDENTIFICACIÓN(?: DEL SUJETO PASIVO)?|RUC)\s*(\d{13})/i;
    const identificacionMatch = text.match(identificacionRegex);
    const identificacion = identificacionMatch ? identificacionMatch[1] : '';

    // Regex to find Razón Social (Business Name)
    const razonSocialRegex = /(?:RAZÓN SOCIAL(?: O APELLIDOS Y NOMBRES COMPLETOS)?)\s+([A-ZÑ\sÁÉÍÓÚÜ]+?)(?:\s+\d{3}|$|\n)/i;
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
