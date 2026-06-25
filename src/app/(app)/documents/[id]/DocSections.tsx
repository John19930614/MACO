/**
 * Renders AI-authored DocSection[] in the Reliance Document Generator master
 * style: numbered navy section banners + template-styled tables, lists, and
 * checkboxes. Parses the lightweight Markdown the program builder emits via the
 * shared `docMarkdown` AST and builds React elements directly — no markdown
 * dependency and no dangerouslySetInnerHTML, so it is XSS-safe.
 */
import type { DocSection } from "@/lib/types";
import {
  parseBlocks,
  splitInline,
  isCheckboxList,
  parseChecklistItem,
} from "@/lib/docMarkdown";

// Template palette (matches Reliance_Document_Generator_Master_Template.docx).
const NAVY = "#17213A";
const BORDER = "#D9E2EF";
const LIGHT = "#F8FAFC";
const BODY = "#334155";
const ACCENT = "#A56BFF";

function inline(text: string, k: string): React.ReactNode[] {
  return splitInline(text).map((tok, i) =>
    tok.bold ? (
      <strong key={`${k}-${i}`} className="font-semibold" style={{ color: NAVY }}>
        {tok.text}
      </strong>
    ) : (
      <span key={`${k}-${i}`}>{tok.text}</span>
    ),
  );
}

function Banner({ number, heading }: { number: number; heading: string }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
      style={{ backgroundColor: NAVY }}
    >
      <span style={{ color: ACCENT }}>{number}.</span>
      <span>{heading}</span>
    </div>
  );
}

function Table({ header, rows, k }: { header: string[]; rows: string[][]; k: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ borderColor: BORDER }}>
        <thead>
          <tr>
            {header.map((h, c) => (
              <th
                key={`${k}-h-${c}`}
                className="border px-3 py-2 text-left font-semibold text-white"
                style={{ backgroundColor: NAVY, borderColor: BORDER }}
              >
                {inline(h, `${k}-h-${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={`${k}-r-${ri}`} style={{ backgroundColor: ri % 2 ? LIGHT : "#FFFFFF" }}>
              {header.map((_, ci) => (
                <td
                  key={`${k}-r-${ri}-${ci}`}
                  className="border px-3 py-2 align-top"
                  style={{ borderColor: BORDER, color: BODY }}
                >
                  {inline(r[ci] ?? "", `${k}-r-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({ ordered, items, k }: { ordered: boolean; items: string[]; k: string }) {
  if (isCheckboxList(items)) {
    return (
      <ul className="space-y-1.5">
        {items.map((it, i) => {
          const { checked, text } = parseChecklistItem(it);
          return (
            <li key={`${k}-${i}`} className="flex items-start gap-2 text-sm" style={{ color: BODY }}>
              <span className="mt-0.5 select-none" style={{ color: NAVY }}>{checked ? "☑" : "☐"}</span>
              <span>{inline(text, `${k}-${i}`)}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  const cls = ordered ? "list-decimal" : "list-disc";
  return (
    <ul className={`${cls} space-y-1.5 pl-5 text-sm`} style={{ color: BODY }}>
      {items.map((it, i) => (
        <li key={`${k}-${i}`}>{inline(it, `${k}-${i}`)}</li>
      ))}
    </ul>
  );
}

function SectionBody({ body, k }: { body: string; k: string }) {
  const blocks = parseBlocks(body);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === "table") return <Table key={`${k}-${i}`} header={b.header} rows={b.rows} k={`${k}-${i}`} />;
        if (b.type === "list") return <List key={`${k}-${i}`} ordered={b.ordered} items={b.items} k={`${k}-${i}`} />;
        return (
          <p key={`${k}-${i}`} className="text-sm leading-relaxed" style={{ color: BODY }}>
            {inline(b.text, `${k}-${i}`)}
          </p>
        );
      })}
    </div>
  );
}

export type DocControlRow = { field: string; value: string };

/** Section 1 — Document Control, rendered from live document metadata. */
export function DocControlBlock({ number, rows }: { number: number; rows: DocControlRow[] }) {
  return (
    <section>
      <Banner number={number} heading="Document Control" />
      <div className="px-1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ borderColor: BORDER }}>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 ? LIGHT : "#FFFFFF" }}>
                  <th
                    className="border px-3 py-2 text-left font-semibold"
                    style={{ borderColor: BORDER, color: NAVY, width: "38%" }}
                  >
                    {r.field}
                  </th>
                  <td className="border px-3 py-2 align-top" style={{ borderColor: BORDER, color: BODY }}>
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function DocSections({ sections, startNumber = 1 }: { sections: DocSection[]; startNumber?: number }) {
  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <section key={i}>
          <Banner number={startNumber + i} heading={s.heading} />
          <div className="px-1">
            <SectionBody body={s.body ?? ""} k={`s-${i}`} />
          </div>
        </section>
      ))}
    </div>
  );
}
