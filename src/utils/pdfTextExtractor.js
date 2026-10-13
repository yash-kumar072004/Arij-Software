import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker for browser extraction
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

/**
 * Extracts readable text from a PDF ArrayBuffer using Mozilla pdfjs-dist.
 * Reconstructs reading order and handles both single-column PRD documents and
 * 2-column Jira issue exports (where left column is Description/Subtasks and
 * right column is Details/Assignee/Priority/Status/Parent/Labels).
 */
export async function extractTextFromPdfArrayBuffer(arrayBuffer) {
  const uint8 =
    arrayBuffer instanceof Uint8Array
      ? arrayBuffer
      : new Uint8Array(arrayBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageTexts = [];
  const rightColumnMetaLines = [];
  const leftColumnLines = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width || 612;
    const textContent = await page.getTextContent();

    // Group items by Y coordinate (within 3.5pt tolerance)
    const items = (textContent.items || [])
      .map((item) => {
        const str = (item.str || '').trim();
        const tx = item.transform ? item.transform[4] : 0;
        const ty = item.transform ? item.transform[5] : 0;
        return { str, x: tx, y: ty, width: item.width || 0 };
      })
      .filter((item) => item.str.length > 0);

    // Detect if this page has a Jira 2-column layout (Details panel on the right > 58% of page width)
    const hasDetailsHeader = items.some(
      (it) => /^Details$/i.test(it.str) && it.x > pageWidth * 0.52
    );
    const splitX = hasDetailsHeader ? pageWidth * 0.56 : pageWidth * 2;

    const groupIntoLines = (subset) => {
      const sorted = [...subset].sort((a, b) => {
        if (Math.abs(b.y - a.y) > 3.5) return b.y - a.y;
        return a.x - b.x;
      });
      const rows = [];
      for (const item of sorted) {
        const existingRow = rows.find((r) => Math.abs(r.y - item.y) <= 3.5);
        if (existingRow) {
          existingRow.items.push(item);
        } else {
          rows.push({ y: item.y, items: [item] });
        }
      }
      return rows
        .map((row) => {
          row.items.sort((a, b) => a.x - b.x);
          let line = '';
          let prevEnd = null;
          for (const it of row.items) {
            if (prevEnd !== null && it.x - prevEnd > 8 && !line.endsWith(' ')) {
              line += ' ';
            }
            line += it.str;
            prevEnd = it.x + (it.width || it.str.length * 4.5);
          }
          return line.replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean);
    };

    if (hasDetailsHeader) {
      const leftItems = items.filter((it) => it.x < splitX);
      const rightItems = items.filter((it) => it.x >= splitX);
      const leftLines = groupIntoLines(leftItems);
      const rightLines = groupIntoLines(rightItems);
      leftColumnLines.push(...leftLines);
      rightColumnMetaLines.push(...rightLines);
      pageTexts.push([...leftLines, '--- DETAILS SIDEBAR ---', ...rightLines].join('\n'));
    } else {
      const allLines = groupIntoLines(items);
      leftColumnLines.push(...allLines);
      pageTexts.push(allLines.join('\n'));
    }
  }

  let metadataTitle = '';
  try {
    const meta = await pdfDoc.getMetadata();
    if (meta?.info?.Title && typeof meta.info.Title === 'string') {
      metadataTitle = meta.info.Title.trim();
    }
  } catch {
    // Ignore metadata errors
  }

  const combinedText = [
    metadataTitle ? `Document Title: ${metadataTitle}` : '',
    ...leftColumnLines,
    rightColumnMetaLines.length > 0 ? '\n--- DETAILS SIDEBAR ---' : '',
    ...rightColumnMetaLines,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    fullText: combinedText,
    leftText: leftColumnLines.join('\n'),
    rightSidebarText: rightColumnMetaLines.join('\n'),
    pageCount: numPages,
    metadataTitle,
  };
}
