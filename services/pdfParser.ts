
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

    for (const item of items) {
      // If the vertical position is significantly different, it's a new line.
      if (currentLine.length > 0 && Math.abs(item.transform[5] - lastY) > 5) {
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
      currentLine.push(item.str);
      lastY = item.transform[5];
    }
    // Add the last line
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }
    
    fullText += lines.join('\n');
    if (i < numPages) {
       fullText += '\n\n--- Page Break ---\n\n';
    }
  }

  return fullText.trim();
}
