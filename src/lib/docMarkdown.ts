/**
 * Shared, framework-agnostic parser for the lightweight Markdown the AI program
 * builder emits in DocSection bodies (pipe tables, numbered/checkbox lists,
 * **bold**). Returns a small block AST that both the on-screen renderer
 * (DocSections.tsx → React) and the Word export (docExport.ts → HTML string)
 * consume, so the two stay in lockstep.
 */

export type Block =
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "para"; text: string };

export type InlineToken = { bold: boolean; text: string };

// **bold** → tokens; everything else is plain text.
export function splitInline(text: string): InlineToken[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("**") && p.endsWith("**")
        ? { bold: true, text: p.slice(2, -2) }
        : { bold: false, text: p },
    );
}

export function tableCells(row: string): string[] {
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

export function isSeparatorRow(row: string): boolean {
  const c = tableCells(row);
  return c.length > 0 && c.every((x) => /^:?-{2,}:?$/.test(x));
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.includes("|", line.indexOf("|") + 1);
}

function isListItem(line: string): boolean {
  return /^\s*(\d+[.)]|[-*])\s+/.test(line);
}

/** Is every item of a list a checkbox item ("[ ]" / "[x]")? */
export function isCheckboxList(items: string[]): boolean {
  return items.length > 0 && items.every((it) => /^\[( |x|X)\]/.test(it));
}

export function parseChecklistItem(item: string): { checked: boolean; text: string } {
  return {
    checked: /^\[(x|X)\]/.test(item),
    text: item.replace(/^\[( |x|X)\]\s*/, ""),
  };
}

export function parseBlocks(body: string): Block[] {
  const lines = (body ?? "").replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Table — consecutive pipe rows
    if (isTableRow(line)) {
      const raw: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) { raw.push(lines[i]); i++; }
      const header = tableCells(raw[0]);
      const dataStart = raw.length > 1 && isSeparatorRow(raw[1]) ? 2 : 1;
      const rows = raw.slice(dataStart).filter((r) => !isSeparatorRow(r)).map(tableCells);
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // List — consecutive ordered/unordered/checkbox items
    if (isListItem(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && isListItem(lines[i])) {
        items.push(lines[i].replace(/^\s*(\d+[.)]|[-*])\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph — until a blank line or a structural line
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isTableRow(lines[i]) && !isListItem(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "para", text: para.join(" ") });
  }
  return blocks;
}
