/**
 * DOCX generator for the Magistrates Attendance Note.
 *
 * Builds a structured Word document from dynamic form values and returns a
 * Blob that can be downloaded directly in the browser.
 *
 * Placeholder keys match the snake_case field_key values stored in
 * template_fields (and defined in CLAUDE.md Placeholder Rules).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export type DocxFormValues = Record<string, string | Array<Record<string, string>>>;

// ── Placeholder mapping ───────────────────────────────────────────────────────

/**
 * Flatten the dynamic form values into a plain string-keyed map of
 * DOCX placeholder values.  Repeater fields are converted to a formatted
 * summary string rather than a nested object.
 */
export function buildPlaceholders(values: DocxFormValues): Record<string, string> {
  const str = (key: string) => (values[key] as string | undefined) ?? "";

  // Offences repeater → formatted summary
  const offenceRows = (values.offences as Array<Record<string, string>>) ?? [];
  const offencesSummary =
    offenceRows
      .filter((r) => r.offence?.trim())
      .map((r, i) => {
        const parts: string[] = [`${i + 1}. ${r.offence}`];
        if (r.so?.trim()) parts.push(`   Summary/Either-way/Indictable: ${r.so}/${r.ew ?? "—"}/${r.io ?? "—"}`);
        if (r.outcome?.trim()) parts.push(`   Outcome: ${r.outcome}`);
        return parts.join("\n");
      })
      .join("\n\n") || "None recorded";

  return {
    // Header
    client: str("client"),
    ufn: str("ufn"),
    fee_earner: str("fee_earner"),
    venue: str("venue"),
    date: str("date"),
    representation_order: str("representation_order"),
    // Offences
    offences_summary: offencesSummary,
    // Instructions
    instructions: str("instructions"),
    // Advice
    advice: str("advice"),
    venue_advice: str("venue_advice"),
    credit_for_guilty_plea: str("credit_for_guilty_plea"),
    strength_of_evidence: str("strength_of_evidence"),
    likely_sentence_on_conviction: str("likely_sentence_on_conviction"),
    // Outcome
    outcome: str("outcome"),
    // Bail
    bail: str("bail"),
    // Next Action
    next_action: str("next_action"),
    // Time Recording
    preparation: str("preparation"),
    attendances: str("attendances"),
    advocacy: str("advocacy"),
    travel: str("travel"),
    waiting: str("waiting"),
    mileage_parking: str("mileage_parking"),
    // Next Hearing
    next_hearing_datetime: str("next_hearing_datetime"),
  };
}

// ── Document building helpers ─────────────────────────────────────────────────

const BRAND = "1F3C2D"; // dark green for headings / accents
const GRAY = "666666";

function docTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: BRAND })],
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND } },
  });
}

/** Bold label + plain value on the same line. */
function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: value || "—", size: 20, color: value ? "000000" : GRAY }),
    ],
    spacing: { after: 80 },
  });
}

/** Multi-line body paragraph (instructions, advice, etc.). */
function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text || "—",
        size: 20,
        color: text ? "000000" : GRAY,
      }),
    ],
    spacing: { after: 160 },
  });
}

/** Blank spacer. */
function spacer(): Paragraph {
  return new Paragraph({ text: "", spacing: { after: 80 } });
}

/** Build the offences table from repeater rows. */
function buildOffencesTable(rows: Array<Record<string, string>>): Table {
  const COLS: { key: string; label: string; width: number }[] = [
    { key: "offence", label: "Offence", width: 35 },
    { key: "so", label: "SO", width: 10 },
    { key: "ew", label: "EW", width: 10 },
    { key: "io", label: "IO", width: 10 },
    { key: "outcome", label: "Outcome", width: 35 },
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: COLS.map(
      (c) =>
        new TableCell({
          width: { size: c.width, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: "E8F0EA" },
          children: [
            new Paragraph({
              children: [new TextRun({ text: c.label, bold: true, size: 18 })],
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: COLS.map(
          (c) =>
            new TableCell({
              width: { size: c.width, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: row[c.key] || "—", size: 18 })],
                }),
              ],
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a Magistrates Attendance Note DOCX and return it as a Blob.
 * Call Packer.toBlob() — safe to use in a browser environment.
 */
export async function generateMagistratesNote(
  values: DocxFormValues
): Promise<Blob> {
  const p = buildPlaceholders(values);
  const offenceRows = (values.offences as Array<Record<string, string>>) ?? [];
  const hasOffences = offenceRows.some((r) => r.offence?.trim());

  const children: (Paragraph | Table)[] = [
    // ── Title ────────────────────────────────────────────────
    docTitle("Magistrates Attendance Note"),

    // ── Client Details ────────────────────────────────────────
    sectionHeading("Client Details"),
    labelValue("Client", p.client),
    labelValue("UFN", p.ufn),
    labelValue("Fee Earner", p.fee_earner),
    labelValue("Venue", p.venue),
    labelValue("Date", p.date),
    labelValue("Representation Order", p.representation_order),

    // ── Offences ─────────────────────────────────────────────
    sectionHeading("Offences"),
    ...(hasOffences
      ? [buildOffencesTable(offenceRows), spacer()]
      : [bodyParagraph("None recorded")]),

    // ── Instructions ─────────────────────────────────────────
    sectionHeading("Instructions"),
    bodyParagraph(p.instructions),

    // ── Advice ───────────────────────────────────────────────
    sectionHeading("Advice"),
    bodyParagraph(p.advice),
    ...(p.venue_advice ? [labelValue("Venue Advice", p.venue_advice)] : []),
    ...(p.credit_for_guilty_plea
      ? [labelValue("Credit for Guilty Plea", p.credit_for_guilty_plea)]
      : []),
    ...(p.strength_of_evidence
      ? [labelValue("Strength of Evidence", p.strength_of_evidence)]
      : []),
    ...(p.likely_sentence_on_conviction
      ? [labelValue("Likely Sentence on Conviction", p.likely_sentence_on_conviction)]
      : []),

    // ── Outcome ──────────────────────────────────────────────
    sectionHeading("Outcome"),
    bodyParagraph(p.outcome),

    // ── Bail ─────────────────────────────────────────────────
    sectionHeading("Bail"),
    bodyParagraph(p.bail),

    // ── Next Action ──────────────────────────────────────────
    sectionHeading("Next Action"),
    bodyParagraph(p.next_action),

    // ── Time Recording ───────────────────────────────────────
    sectionHeading("Time Recording"),
    labelValue("Preparation", p.preparation),
    labelValue("Attendances", p.attendances),
    labelValue("Advocacy", p.advocacy),
    labelValue("Travel", p.travel),
    labelValue("Waiting", p.waiting),
    labelValue("Mileage / Parking", p.mileage_parking),

    // ── Next Hearing ─────────────────────────────────────────
    sectionHeading("Next Hearing"),
    labelValue("Next Hearing Date & Time", p.next_hearing_datetime),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

/** Derive a safe filename from form values. */
export function buildFileName(values: DocxFormValues): string {
  const client = ((values.client as string) || "draft")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase()
    .slice(0, 30);
  const date = (values.date as string) || new Date().toISOString().slice(0, 10);
  return `magistrates-note-${client}-${date}.docx`;
}
