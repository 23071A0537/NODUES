import fs from "fs";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { sql } from "../config/db.js";

const TEMPLATE_ROWS = [
  { label: "i) Mentor*", aliases: ["mentor"] },
  {
    label: "ii) IV B.Tech. Project Guide",
    aliases: ["iv b.tech. project guide", "project guide"],
  },
  {
    label: "iii) Head of the Department",
    aliases: ["head of the department", "hod"],
  },
  { label: "Department Library", aliases: ["department library", "dept library"] },
  { label: "Library", aliases: ["library", "central library"] },
  {
    label: "CAMS / EDUPRIME (B-115)",
    aliases: ["cams", "eduprime", "cams / eduprime"],
  },
  {
    label: "Scholarship Section (A-001)",
    aliases: ["scholarship", "scholarship section"],
  },
  { label: "Hostel", aliases: ["hostel"] },
  {
    label: "Accounts Section (B-119)",
    aliases: ["accounts", "accounts section"],
  },
  {
    label: "Research and Development Cell (P-119)",
    aliases: ["research and development cell", "r and d cell", "rnd cell"],
  },
  {
    label: "Training & Placement Cell (P - 414)",
    aliases: ["training and placement cell", "placement cell", "t and p"],
  },
  {
    label: "Alumni Association (P - 308)",
    aliases: ["alumni association", "alumni"],
  },
  { label: "Sports", aliases: ["sports"] },
  { label: "Academic Section", aliases: ["academic", "academic section"] },
];

const normalizeLabel = (label) => {
  if (!label) return "";
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const buildTemplateIndex = () => {
  return TEMPLATE_ROWS.map((row) => {
    const aliases = [row.label, ...(row.aliases || [])]
      .map((alias) => normalizeLabel(alias))
      .filter(Boolean);
    return { ...row, normalizedAliases: Array.from(new Set(aliases)) };
  });
};

const TEMPLATE_INDEX = buildTemplateIndex();
const DEFAULT_HEADER_IMAGE_PATH = fileURLToPath(
  new URL("../assets/no_dues_header.jpeg", import.meta.url),
);
const HEADER_IMAGE_PATH =
  process.env.NO_DUES_HEADER_IMAGE_PATH || DEFAULT_HEADER_IMAGE_PATH;
const HEADER_IMAGE_SIZE = 70;

export const fetchActiveIssuerNamesForStudent = async (rollNumber) => {
  const results = await sql`
    SELECT DISTINCT issuer_name
    FROM (
      SELECT d.name as issuer_name
      FROM department_dues dd
      LEFT JOIN departments d ON dd.added_by_department_id = d.id
      WHERE dd.student_roll_number = ${rollNumber}
        AND dd.overall_status = FALSE

      UNION ALL

      SELECT 'Head of the Department' as issuer_name
      FROM department_dues dd
      WHERE dd.student_roll_number = ${rollNumber}
        AND dd.overall_status = FALSE

      UNION ALL

      SELECT sec.name as issuer_name
      FROM alumni_dues ad
      LEFT JOIN sections sec ON ad.added_by_section_id = sec.id
      WHERE ad.student_roll_number = ${rollNumber}
        AND ad.overall_status = FALSE
        AND ad.added_by_section_id IS NOT NULL
    ) issuer_rows
  `;

  return results
    .map((row) => row.issuer_name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);
};

export const buildNoDuesStatusRows = (activeIssuerNames) => {
  const normalizedActive = activeIssuerNames.map(normalizeLabel).filter(Boolean);
  const activeSet = new Set(normalizedActive);

  const templateRows = TEMPLATE_INDEX.map((row) => {
    const hasDue = row.normalizedAliases.some((alias) => activeSet.has(alias));
    return { label: row.label, hasDue };
  });

  const matchedTemplateAliases = new Set(
    TEMPLATE_INDEX.flatMap((row) => row.normalizedAliases),
  );

  const extraRowsMap = new Map();
  activeIssuerNames.forEach((name) => {
    const normalized = normalizeLabel(name);
    if (!normalized) return;
    if (!matchedTemplateAliases.has(normalized)) {
      if (!extraRowsMap.has(normalized)) {
        extraRowsMap.set(normalized, { label: name, hasDue: true });
      }
    }
  });

  return {
    templateRows,
    extraRows: Array.from(extraRowsMap.values()),
  };
};

export const fetchStudentByRoll = async (rollNumber) => {
  const results = await sql`
    SELECT
      s.name,
      s.roll_number,
      s.branch
    FROM students s
    WHERE s.roll_number = ${rollNumber}
    LIMIT 1
  `;

  return results[0] || null;
};

export const fetchStudentById = async (studentId) => {
  const results = await sql`
    SELECT
      s.name,
      s.roll_number,
      s.branch
    FROM students s
    WHERE s.student_id = ${studentId}
    LIMIT 1
  `;

  return results[0] || null;
};

const drawTable = (doc, rows) => {
  const margin = 40;
  const startX = margin;
  let currentY = doc.y + 10;
  const tableWidth = doc.page.width - margin * 2;
  const colWidths = [280, 95, 140];

  const header = [
    "Name of the Department/Section",
    "Dues (Yes/No)",
    "Signature with date",
  ];
  const allRows = [
    header,
    ...rows.map((row) => [row.label, row.hasDue ? "YES" : "NO", ""]),
  ];

  if (rows.length === 0) {
    allRows.push(["No additional departments/sections", "NO", ""]);
  }

  allRows.forEach((row, index) => {
    const isHeader = index === 0;
    const values = Array.isArray(row)
      ? row
      : [row.label || String(row), row.hasDue ? "YES" : "NO", ""];
    while (values.length < colWidths.length) {
      values.push("");
    }

    const heights = values.map((value, colIndex) => {
      const width = colWidths[colIndex] - 10;
      return doc.heightOfString(String(value), { width });
    });
    const rowHeight = Math.max(...heights) + 10;

    let x = startX;
    values.forEach((value, colIndex) => {
      doc
        .rect(x, currentY, colWidths[colIndex], rowHeight)
        .stroke();
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .text(String(value), x + 5, currentY + 5, {
          width: colWidths[colIndex] - 10,
          align: colIndex === 1 ? "center" : "left",
        });
      x += colWidths[colIndex];
    });

    currentY += rowHeight;
  });

  doc.moveDown(1);
};

export const renderNoDuesFormPdf = ({
  res,
  student,
  rows,
  tableTitle,
  filename,
  includeMentorNote,
}) => {
  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
    info: {
      Title: "No Dues Form",
      Author: "VNRVJIET",
      Subject: "No Dues Form",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  doc.pipe(res);

  doc.fontSize(10).font("Helvetica");

  if (fs.existsSync(HEADER_IMAGE_PATH)) {
    const logoX = (doc.page.width - HEADER_IMAGE_SIZE) / 2;
    const logoY = doc.y;
    doc.image(HEADER_IMAGE_PATH, logoX, logoY, {
      fit: [HEADER_IMAGE_SIZE, HEADER_IMAGE_SIZE],
      align: "center",
      valign: "top",
    });
    doc.y = logoY + HEADER_IMAGE_SIZE + 8;
  }

  doc.text("Estd.1995", { align: "center" });
  doc.fontSize(14).font("Helvetica-Bold");
  doc.text("VALLURUPALLI NAGESWARA RAO VIGNANA JYOTHI", { align: "center" });
  doc.text("INSTITUTE OF ENGINEERING AND TECHNOLOGY", { align: "center" });
  doc.fontSize(9).font("Helvetica");
  doc.text(
    "An Autonomous, ISO 9001:2015 & QS I-Gauge Diamond Rated Institute, Accredited by NAAC with A++ Grade",
    { align: "center" },
  );
  doc.text(
    "NBA Accreditation for B.Tech. - CE, EEE, ME, ECE, CSE, EIE, IT, AME Programmes and M.Tech. - STRE, PE, AMS, SWE Programmes",
    { align: "center" },
  );
  doc.text(
    "Approved by AICTE, New Delhi, Affiliated to JNTUH, NIRF 2023: 101-150 Rank in Engineering Category",
    { align: "center" },
  );
  doc.text(
    "Recognized as College with Potential for Excellence by UGC",
    { align: "center" },
  );
  doc.text(
    "Vignana Jyothi Nagar, Pragathi Nagar, Nizampet (S.O), Hyderabad - 500 090, TS, India.",
    { align: "center" },
  );
  doc.text(
    "Telephone No: 040-2304 2758/59/60, Fax: 040-23042761",
    { align: "center" },
  );
  doc.text("E-mail: postbox@vnrvjiet.ac.in, Website: www.vnrvjiet.ac.in", {
    align: "center",
  });

  doc.moveDown(1.5);
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("NO DUES CERTIFICATE FOR B.TECH.", { align: "center" });
  doc.moveDown(1);

  doc.fontSize(10).font("Helvetica");
  doc.text(`Name of the student : ${student?.name || ""}`);
  doc.text(`Roll no.: ${student?.roll_number || ""}`);
  doc.text(`Branch: ${student?.branch || ""}`);
  doc.moveDown(0.5);
  doc.text("This is to certify that there are no dues outstanding against the above student.");

  if (tableTitle) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text(tableTitle, { align: "left" });
  }

  drawTable(doc, rows);

  if (includeMentorNote) {
    doc.font("Helvetica").fontSize(9);
    doc.text("*Mentor to ensure the receipt of proofs of the following in both soft and hard copy format:");
    doc.text("Student Placements / Higher Studies: Offer letters / Admission letters; GATE / GRE / CAT / GMAT / TOEFL scores etc.");
    doc.text("Professional Societies / Chapters: Memberships / Editors / Publishers for News Letters / Technical Magazine etc. / Any other organizing role for Professional Chapters, etc.");
    doc.text("Student Achievements / Participations:");
    doc.text("CCA: Technical events - Paper presentations / Publications / Patents / Design contests / Hackathons / Project exhibitions / Open house / Workshops / Certifications - NPTEL, MOOCS etc.");
    doc.text("ECA: Sports / Cultural Events, etc.");
    doc.text("Extension Activities: NSS / VNRSF, etc.");
    doc.moveDown(0.5);
    doc.text("Permanent Address, Mobile Number & Email id");
  }

  doc.end();
};
