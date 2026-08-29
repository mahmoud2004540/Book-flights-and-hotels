import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BRAND } from "@/lib/config";

/**
 * The ticket PDF — section 13, deliverable for stage 5.
 *
 * Built with pdf-lib rather than a headless browser: generating a PDF by
 * rendering HTML would mean shipping Chromium into the serverless function,
 * which is slow to cold-start and expensive for a one-page document.
 */

export type TicketSegment = {
  carrierName: string;
  flightNumber: string;
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
};

export type TicketData = {
  reference: string;
  pnr: string | null;
  passengers: string[];
  segments: TicketSegment[];
  total: string;
  issuedAt: Date;
};

const INK = rgb(0.067, 0.094, 0.137);
const MUTED = rgb(0.33, 0.39, 0.48);
/**
 * The same #8c4d04 as --brand in globals.css. pdf-lib takes 0-1 components, so
 * it cannot read the CSS token; the hex is written above it so the two can be
 * checked against each other by eye rather than by arithmetic.
 */
const BRAND_AMBER = rgb(0.549, 0.302, 0.016);

/**
 * The standard PDF fonts encode WinAnsi only, and pdf-lib throws on anything
 * outside it. Passenger names come from travellers, so a name in Arabic or
 * Chinese would otherwise crash ticket generation for a real booking. Unknown
 * characters are transliterated where there is an obvious equivalent and
 * dropped otherwise, which keeps the document readable and never throws.
 */
function winAnsiSafe(text: string): string {
  return text
    .normalize("NFKD")
    // Combining marks: José becomes Jose rather than failing.
    .replace(/\p{M}/gu, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2192/g, ">")
    .split("")
    .map((character) => (character.charCodeAt(0) <= 0xff ? character : "?"))
    .join("");
}

function clock(iso: string): string {
  const date = new Date(iso);
  return `${date.toISOString().slice(0, 10)}  ${date.toISOString().slice(11, 16)}`;
}

export async function buildTicketPdf(data: TicketData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 at 72dpi
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 56;
  let y = 780;

  const write = (
    text: string,
    size: number,
    font = regular,
    color = INK,
    x = left,
  ) => {
    page.drawText(winAnsiSafe(text), { x, y, size, font, color });
  };

  write(BRAND.name, 18, bold, BRAND_AMBER);
  y -= 14;
  write("Booking confirmation", 10, regular, MUTED);

  y -= 40;
  page.drawRectangle({ x: left, y: y - 12, width: 483, height: 46, color: rgb(0.945, 0.957, 0.972) });
  write("BOOKING REFERENCE", 8, bold, MUTED, left + 14);
  y -= 20;
  write(data.reference, 20, bold, INK, left + 14);
  if (data.pnr) {
    write(`Airline reference  ${data.pnr}`, 9, regular, MUTED, left + 220);
  }

  y -= 54;
  write("TRAVELLERS", 8, bold, MUTED);
  for (const passenger of data.passengers) {
    y -= 16;
    write(passenger, 11);
  }

  y -= 34;
  write("ITINERARY", 8, bold, MUTED);

  for (const segment of data.segments) {
    y -= 20;
    write(`${segment.carrierName}  ${segment.flightNumber}`, 11, bold);
    y -= 15;
    write(`${segment.from}  \u2192  ${segment.to}`, 10, regular, MUTED);
    y -= 14;
    write(`Departs  ${clock(segment.departAt)}`, 9, regular, MUTED);
    y -= 12;
    write(`Arrives  ${clock(segment.arriveAt)}`, 9, regular, MUTED);
    y -= 8;
  }

  y -= 26;
  page.drawLine({
    start: { x: left, y },
    end: { x: left + 483, y },
    thickness: 0.7,
    color: rgb(0.812, 0.847, 0.89),
  });

  y -= 22;
  write("TOTAL PAID", 8, bold, MUTED);
  write(data.total, 14, bold, INK, left + 380);

  y = 70;
  write(
    `Issued ${data.issuedAt.toISOString().slice(0, 10)} · ${BRAND.domain}`,
    8,
    regular,
    MUTED,
  );
  y -= 12;
  write(
    "Carry photo identification matching the traveller names above.",
    8,
    regular,
    MUTED,
  );

  return pdf.save();
}
