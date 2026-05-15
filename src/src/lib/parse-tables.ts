export interface ParsedTable {
  headers: string[];
  rows: string[][];
  numericColumns: number[];
  title?: string;
}

export interface ContentSegment {
  type: "text" | "table";
  content: string;
  table?: ParsedTable;
}

const TABLE_REGEX = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;

export function parseNumericValue(str: string): number | null {
  if (!str || typeof str !== "string") return null;
  // Remove currency symbols, percentages, commas, whitespace
  const cleaned = str
    .replace(/[Ss]\/\.?\s*/g, "")
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseTable(match: string, precedingText: string): ParsedTable {
  const lines = match.trim().split("\n");
  if (lines.length < 3) {
    return { headers: [], rows: [], numericColumns: [] };
  }

  const headers = lines[0]
    .split("|")
    .filter((h) => h.trim())
    .map((h) => h.trim());

  const rows = lines.slice(2).map((row) =>
    row
      .split("|")
      .filter((c) => c.trim() !== "")
      .map((c) => c.trim())
  );

  // Detect numeric columns (>50% of values are numeric)
  const numericColumns: number[] = [];
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    let numericCount = 0;
    let totalCount = 0;
    for (const row of rows) {
      if (colIdx < row.length && row[colIdx]) {
        totalCount++;
        if (parseNumericValue(row[colIdx]) !== null) {
          numericCount++;
        }
      }
    }
    if (totalCount > 0 && numericCount / totalCount > 0.5) {
      numericColumns.push(colIdx);
    }
  }

  // Extract title from preceding text (last non-empty line before table)
  let title: string | undefined;
  if (precedingText) {
    const textLines = precedingText.trim().split("\n");
    const lastLine = textLines[textLines.length - 1]?.trim();
    if (lastLine && !lastLine.startsWith("|") && lastLine.length < 200) {
      title = lastLine.replace(/^#+\s*/, "").replace(/\*\*/g, "");
    }
  }

  return { headers, rows, numericColumns, title };
}

export function parseMessageContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  TABLE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TABLE_REGEX.exec(content)) !== null) {
    const tableStart = match.index;

    // Text before the table
    if (tableStart > lastIndex) {
      const textContent = content.slice(lastIndex, tableStart);
      if (textContent.trim()) {
        segments.push({ type: "text", content: textContent });
      }
    }

    // The table itself
    const precedingText = content.slice(lastIndex, tableStart);
    const parsed = parseTable(match[0], precedingText);
    if (parsed.headers.length > 0) {
      segments.push({
        type: "table",
        content: match[0],
        table: parsed,
      });
    }

    lastIndex = tableStart + match[0].length;
  }

  // Remaining text after last table
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (remaining.trim()) {
      segments.push({ type: "text", content: remaining });
    }
  }

  // If no tables found, return the whole content as text
  if (segments.length === 0) {
    segments.push({ type: "text", content });
  }

  return segments;
}

export function hasTableContent(content: string): boolean {
  TABLE_REGEX.lastIndex = 0;
  return TABLE_REGEX.test(content);
}
