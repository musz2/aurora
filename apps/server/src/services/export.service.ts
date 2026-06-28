import type { ActionItem, Meeting, MeetingSummary, TranscriptSegment } from "@prisma/client";

export type ExportFormat = "pdf" | "docx" | "txt" | "srt" | "vtt" | "json";

export interface ExportableMeeting
  extends Meeting {
  summary: MeetingSummary | null;
  segments: TranscriptSegment[];
  actionItems: ActionItem[];
}

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  extension: ExportFormat;
}

export function safeExportFilename(title: string, extension: ExportFormat) {
  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "meeting";
  return `${safeTitle}.${extension}`;
}

export function exportResponseHeaders(title: string, result: Pick<ExportResult, "contentType" | "extension">) {
  return {
    "Content-Type": result.contentType,
    "Content-Disposition": `attachment; filename="${safeExportFilename(title, result.extension)}"`,
  };
}

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return map[c] ?? c;
  });
}

function formatTime(totalSeconds: number, separator: "," | ".") {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(millis).padStart(3, "0")}`;
}

function transcriptText(meeting: ExportableMeeting) {
  return meeting.segments
    .map((s) => `[${formatTime(s.startTime, ".")}] ${s.speakerName}: ${s.text}`)
    .join("\n");
}

function meetingText(meeting: ExportableMeeting) {
  const lines = [
    meeting.title,
    `Status: ${meeting.status}`,
    `Source: ${meeting.source}`,
    `Duration: ${meeting.duration} seconds`,
    "",
  ];
  if (meeting.summary) {
    lines.push("Summary", meeting.summary.overview, "");
    lines.push("Key points", ...meeting.summary.keyPoints.map((p) => `- ${p}`), "");
    lines.push("Decisions", ...meeting.summary.decisions.map((d) => `- ${d}`), "");
    lines.push("Follow-up email", meeting.summary.followUpEmail, "");
  }
  if (meeting.actionItems.length) {
    lines.push(
      "Action items",
      ...meeting.actionItems.map(
        (a) =>
          `- ${a.task}${a.assigneeName ? ` (${a.assigneeName})` : ""}${a.dueDate ? ` due ${a.dueDate.toISOString().slice(0, 10)}` : ""}`
      ),
      ""
    );
  }
  lines.push("Transcript", transcriptText(meeting));
  return lines.join("\n");
}

function srt(meeting: ExportableMeeting) {
  return meeting.segments
    .map(
      (s, i) =>
        `${i + 1}\n${formatTime(s.startTime, ",")} --> ${formatTime(s.endTime || s.startTime + 3, ",")}\n${s.speakerName}: ${s.text}\n`
    )
    .join("\n");
}

function vtt(meeting: ExportableMeeting) {
  return `WEBVTT\n\n${meeting.segments
    .map(
      (s) =>
        `${formatTime(s.startTime, ".")} --> ${formatTime(s.endTime || s.startTime + 3, ".")}\n<v ${s.speakerName}>${s.text}\n`
    )
    .join("\n")}`;
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdf(meeting: ExportableMeeting) {
  const lines = meetingText(meeting).split("\n").slice(0, 90);
  const stream = lines
    .map((line, index) => `BT /F1 10 Tf 50 ${760 - index * 14} Td (${pdfEscape(line.slice(0, 100))}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<{ name: string; content: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function docx(meeting: ExportableMeeting) {
  const paragraphs = meetingText(meeting)
    .split("\n")
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeText(line)}</w:t></w:r></w:p>`)
    .join("");
  return zip([
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: "word/document.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`,
    },
  ]);
}

export function exportMeeting(meeting: ExportableMeeting, format: ExportFormat): ExportResult {
  if (format === "json") {
    return {
      buffer: Buffer.from(JSON.stringify(meeting, null, 2)),
      contentType: "application/json",
      extension: "json",
    };
  }
  if (format === "srt") {
    return { buffer: Buffer.from(srt(meeting)), contentType: "application/x-subrip", extension: "srt" };
  }
  if (format === "vtt") {
    return { buffer: Buffer.from(vtt(meeting)), contentType: "text/vtt", extension: "vtt" };
  }
  if (format === "pdf") {
    return { buffer: pdf(meeting), contentType: "application/pdf", extension: "pdf" };
  }
  if (format === "docx") {
    return {
      buffer: docx(meeting),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  }
  return { buffer: Buffer.from(meetingText(meeting)), contentType: "text/plain; charset=utf-8", extension: "txt" };
}
