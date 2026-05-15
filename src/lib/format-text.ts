/**
 * Formats markdown-like text to HTML.
 * Handles: **bold**, *italic*, `code`, bullet lists, numbered lists, headings.
 * Does NOT handle tables — those are parsed separately by parse-tables.ts.
 */
export function formatTextContent(content: string): string {
  if (!content) return "";
  let formatted = content;

  // Headings (### → h4, ## → h3, # → h2) - before bold processing
  formatted = formatted.replace(
    /^### (.*)$/gm,
    '<h4 class="text-sm font-bold mt-3 mb-1">$1</h4>'
  );
  formatted = formatted.replace(
    /^## (.*)$/gm,
    '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>'
  );

  // Bold and italic
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Inline code
  formatted = formatted.replace(
    /`(.*?)`/g,
    '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>'
  );

  // Unordered lists
  formatted = formatted.replace(
    /^- (.*)$/gm,
    '<li class="ml-4 list-disc">$1</li>'
  );
  formatted = formatted.replace(
    /^\* (.*)$/gm,
    '<li class="ml-4 list-disc">$1</li>'
  );
  formatted = formatted.replace(
    /((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g,
    '<ul class="my-1 space-y-0.5 text-sm">$1</ul>'
  );

  // Numbered lists
  formatted = formatted.replace(
    /^\d+\.\s+(.*)$/gm,
    '<li class="ml-4 list-decimal">$1</li>'
  );
  formatted = formatted.replace(
    /((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g,
    '<ol class="my-1 space-y-0.5 text-sm">$1</ol>'
  );

  // Horizontal rules
  formatted = formatted.replace(
    /^---$/gm,
    '<hr class="my-2 border-border" />'
  );

  // Line breaks
  formatted = formatted.replace(/\n/g, "<br />");

  return formatted;
}
