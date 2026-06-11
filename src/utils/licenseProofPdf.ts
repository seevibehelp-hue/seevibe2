// License Proof PDF generator — produces a tamper-evident ownership document
// for a See Vibe project. Pure client-side (pdf-lib + qrcode) so the master
// audio never has to leave the browser.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export interface LicenseProofInput {
  projectId: string;
  projectName: string;
  ownerName: string;
  ownerEmail: string;
  bpm: number;
  key: string;
  scale: string;
  durationSec: number;
  sampleRate: number;
  tracks: Array<{
    name: string;
    type: string;
    clipCount: number;
    fxSummary?: string;
  }>;
  aiPromptHistory: string[]; // chronological user prompts
  masterWavBuffer: ArrayBuffer; // for SHA-256 fingerprint
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export async function generateLicenseProofPdf(
  input: LicenseProofInput,
): Promise<Blob> {
  const proofId =
    (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const fingerprint = await sha256Hex(input.masterWavBuffer);
  const generatedAt = new Date();

  const verifyPayload = JSON.stringify({
    proofId,
    projectId: input.projectId,
    fingerprint,
    issuedAt: generatedAt.toISOString(),
  });
  const qrDataUrl = await QRCode.toDataURL(verifyPayload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let page = pdf.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  let y = height - 56;

  const drawText = (
    text: string,
    opts: { x?: number; size?: number; font?: any; color?: any } = {},
  ) => {
    page.drawText(text, {
      x: opts.x ?? 56,
      y,
      size: opts.size ?? 11,
      font: opts.font ?? font,
      color: opts.color ?? rgb(0.1, 0.1, 0.1),
    });
  };

  const line = (h = 14) => {
    y -= h;
    if (y < 80) {
      page = pdf.addPage([612, 792]);
      y = height - 56;
    }
  };

  // Header
  drawText("SEE VIBE — LICENSE PROOF OF AUTHORSHIP", {
    size: 16,
    font: bold,
    color: rgb(0, 0.6, 0.4),
  });
  line(22);
  drawText(`Proof ID: ${proofId}`, { font: mono, size: 9 });
  line();
  drawText(`Issued: ${generatedAt.toISOString()}`, { font: mono, size: 9 });
  line(20);

  // QR code (top-right)
  const qrBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
  const qrImage = await pdf.embedPng(qrBytes);
  page.drawImage(qrImage, { x: width - 180, y: height - 200, width: 140, height: 140 });
  page.drawText("Scan to verify", {
    x: width - 170, y: height - 215, size: 8, font, color: rgb(0.4, 0.4, 0.4),
  });

  // Owner block
  drawText("RIGHTS HOLDER", { font: bold, size: 12 });
  line(16);
  drawText(`Name:  ${input.ownerName || "(unspecified)"}`);
  line();
  drawText(`Email: ${input.ownerEmail || "(unspecified)"}`);
  line(20);

  // Work info
  drawText("WORK DETAILS", { font: bold, size: 12 });
  line(16);
  drawText(`Title:        ${input.projectName}`);
  line();
  drawText(`Project ID:   ${input.projectId}`, { font: mono, size: 9 });
  line();
  drawText(`BPM:          ${input.bpm}`);
  line();
  drawText(`Key / Scale:  ${input.key} ${input.scale}`);
  line();
  drawText(`Duration:     ${formatDuration(input.durationSec)}`);
  line();
  drawText(`Sample Rate:  ${input.sampleRate} Hz`);
  line(20);

  // Tracks
  drawText(`TRACKS (${input.tracks.length})`, { font: bold, size: 12 });
  line(16);
  for (const t of input.tracks) {
    drawText(
      `• ${t.name} [${t.type}] — ${t.clipCount} clip(s)${t.fxSummary ? ` — FX: ${t.fxSummary}` : ""}`,
      { size: 10 },
    );
    line();
  }
  line(10);

  // AI prompt history
  drawText(`AI PROMPT HISTORY (${input.aiPromptHistory.length})`, {
    font: bold,
    size: 12,
  });
  line(16);
  input.aiPromptHistory.slice(0, 40).forEach((p, i) => {
    const truncated = p.length > 110 ? p.slice(0, 107) + "..." : p;
    drawText(`${i + 1}. ${truncated}`, { size: 9 });
    line(12);
  });
  line(10);

  // Fingerprint
  drawText("MASTER AUDIO FINGERPRINT (SHA-256)", { font: bold, size: 12 });
  line(16);
  // Split hash to fit
  for (let i = 0; i < fingerprint.length; i += 64) {
    drawText(fingerprint.slice(i, i + 64), { font: mono, size: 9 });
    line(12);
  }
  line(10);

  // Declaration
  drawText("DECLARATION OF AUTHORSHIP", { font: bold, size: 12 });
  line(16);
  const declaration = [
    `I, ${input.ownerName || "the undersigned rights holder"}, certify that the work titled`,
    `"${input.projectName}" was composed, produced, and rendered using the See Vibe`,
    `music production platform on ${generatedAt.toDateString()}. The SHA-256 fingerprint`,
    `above uniquely identifies the master audio file rendered from this project at the`,
    `time of issue. This document, together with the QR code, constitutes proof of`,
    `creation and ownership for licensing, distribution, and copyright registration.`,
  ];
  for (const ln of declaration) {
    drawText(ln, { size: 10 });
    line();
  }
  line(20);

  drawText("Signature: ___________________________________", { size: 11 });
  line(28);
  drawText("Date: _____________________", { size: 11 });
  line(40);

  drawText("Generated by See Vibe — seevibe.lovable.app", {
    size: 8,
    font: mono,
    color: rgb(0.5, 0.5, 0.5),
  });

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
