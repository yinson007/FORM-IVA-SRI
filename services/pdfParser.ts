
// This assumes pdf.js is loaded from the CDN in index.html
// The type `pdfjsLib` is not available globally, so we declare it.
declare const pdfjsLib: any;

export async function parsePdfText(file: File): Promise<string> {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('pdf.js library is not loaded. Please check the script tag in your HTML file.');
  }

  // Setting worker path is crucial for pdf.js to work in most environments
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    if (!textContent.items || textContent.items.length === 0) {
      continue;
    }

    // Sort items to reconstruct the document's reading order.
    // The PDF coordinate system has the origin at the bottom-left corner.
    // We sort by y-coordinate descending (top to bottom), then x-coordinate ascending (left to right).
    const items = textContent.items.slice().sort((a: any, b: any) => {
      const y1 = a.transform[5];
      const y2 = b.transform[5];
      const x1 = a.transform[4];
      const x2 = b.transform[4];

      // A small tolerance to consider items on the same line.
      const yTolerance = 5;

      if (Math.abs(y1 - y2) > yTolerance) { 
        return y2 - y1; // Different lines, sort by Y descending
      }
      return x1 - x2; // Same line, sort by X ascending
    });

    let lines: string[] = [];
    let currentLine: string[] = [];
    let lastY = items.length > 0 ? items[0].transform[5] : 0;
    let lastX = items.length > 0 ? items[0].transform[4] : 0;
    let lastWidth = items.length > 0 ? (items[0].width || 0) : 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const currentX = item.transform[4];
      const currentY = item.transform[5];
      const currentWidth = item.width || 0;

      // Si la posición vertical es significativamente diferente, es una nueva línea.
      if (currentLine.length > 0 && Math.abs(currentY - lastY) > 5) {
        lines.push(currentLine.join(' ').replace(/\s+/g, ' '));
        currentLine = [];
        lastX = 0;
        lastWidth = 0;
      }

      // Heurística para unir fragmentos de texto que están muy cerca horizontalmente (sin espacio)
      // Esto evita que números como "1.23" se separen en "1. 23"
      const distance = currentX - (lastX + lastWidth);
      
      if (currentLine.length > 0 && distance < 3 && distance > -1) {
        // Unir al último elemento sin espacio
        currentLine[currentLine.length - 1] += item.str;
      } else {
        currentLine.push(item.str);
      }

      lastY = currentY;
      lastX = currentX;
      lastWidth = currentWidth;
    }
    // Añadir la última línea
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' ').replace(/\s+/g, ' '));
    }
    
    fullText += lines.join('\n');
    if (i < numPages) {
       fullText += '\n\n--- Page Break ---\n\n';
    }
  }

  return fullText.trim();
}
