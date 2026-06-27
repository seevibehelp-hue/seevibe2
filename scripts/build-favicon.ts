// Build favicon.ico + PNG launcher assets from the new SeeVibe logo SVG.
// Run with: bun run scripts/build-favicon.ts
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const SOURCE_JPG = '/workspace/conversations/2026-06-18T22-18-47.252Z_20e69151-b14d-421c-86e1-7774d94ad1b2/attachments/IMG-20260624-WA0000.jpg';

// SVG version of the SeeVibe logo — same design as src/components/SeeVibeLogo.tsx.
// 120x120 viewBox so it scales cleanly to any size.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <radialGradient id="bg" cx="50%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#26262c"/>
      <stop offset="55%" stop-color="#15151a"/>
      <stop offset="100%" stop-color="#08080b"/>
    </radialGradient>
    <linearGradient id="edge" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3a3a42" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#1a1a20" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#0a0a0d" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="bar" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffe28a"/>
      <stop offset="45%" stop-color="#f5b942"/>
      <stop offset="100%" stop-color="#b87412"/>
    </linearGradient>
    <linearGradient id="barGlow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff2c0"/>
      <stop offset="100%" stop-color="#ffb84d"/>
    </linearGradient>
    <radialGradient id="sphere" cx="38%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#4a4a52"/>
      <stop offset="35%" stop-color="#1d1d22"/>
      <stop offset="75%" stop-color="#0a0a0d"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <radialGradient id="rim" cx="50%" cy="50%" r="50%">
      <stop offset="80%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="95%" stop-color="#3a3a40" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="crescent" cx="50%" cy="20%" r="65%">
      <stop offset="0%" stop-color="#fff5cc" stop-opacity="1"/>
      <stop offset="35%" stop-color="#ffd24a" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#f5a623" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#a85f0a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="spec" cx="38%" cy="26%" r="38%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5"/>
    </filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.4"/>
    </filter>
  </defs>

  <rect x="3" y="3" width="114" height="114" rx="26" ry="26" fill="url(#bg)"/>
  <rect x="3" y="3" width="114" height="114" rx="26" ry="26" fill="none" stroke="url(#edge)" stroke-width="1"/>

  ${(() => {
    const barWidth = 2.8;
    const barCount = 23;
    const startX = 18;
    const spacing = 3.7;
    const maxHeight = 62;
    const centerY = 60;
    const out: string[] = [];
    for (let i = 0; i < barCount; i++) {
      const x = startX + i * spacing;
      const dist = Math.abs(x - 60);
      const h = Math.max(3, maxHeight - dist * 1.7);
      if (h <= 3) continue;
      const y = centerY - h / 2;
      const op = 1 - Math.max(0, (dist - 28) / 30) * 0.6;
      const finalOp = Math.max(0.4, op);
      out.push(`<rect x="${(x - barWidth / 2).toFixed(2)}" y="${(y - 1).toFixed(2)}" width="${barWidth}" height="${(h + 2).toFixed(2)}" rx="${(barWidth / 2).toFixed(2)}" fill="url(#barGlow)" opacity="0.55"/>`);
      out.push(`<rect x="${(x - barWidth / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth}" height="${h.toFixed(2)}" rx="${(barWidth / 2).toFixed(2)}" fill="url(#bar)" opacity="0.85"/>`);
      out.push(`<rect x="${(x - barWidth / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth}" height="${h.toFixed(2)}" rx="${(barWidth / 2).toFixed(2)}" fill="url(#bar)" opacity="${finalOp.toFixed(2)}"/>`);
    }
    return out.join('\n  ');
  })()}

  <circle cx="60" cy="60" r="22" fill="url(#sphere)"/>
  <circle cx="60" cy="60" r="22.5" fill="url(#rim)"/>
  <path d="M 40 62 C 42 78, 56 84, 62 84 C 70 84, 80 78, 80 60 C 78 70, 70 76, 60 76 C 50 76, 44 70, 40 62 Z" fill="url(#crescent)" opacity="1"/>
  <ellipse cx="60" cy="74" rx="22" ry="9" fill="url(#crescent)" opacity="0.45"/>
  <path d="M 44 66 C 48 76, 58 80, 64 80" stroke="#fff0b0" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.85"/>
  <ellipse cx="52" cy="50" rx="9" ry="6" fill="url(#spec)"/>
  <circle cx="51" cy="48" r="1.6" fill="#ffffff" opacity="0.7"/>
</svg>`;

// Encode an ICO file from an array of PNG buffers (each at a target size).
// ICO format: ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes per image) + PNG data.
async function buildIco(pngBuffers: Array<{ size: number; buf: Buffer }>): Promise<Buffer> {
  const numImages = pngBuffers.length;
  const headerSize = 6 + numImages * 16;
  let offset = headerSize;

  const dirEntries: Buffer[] = [];
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    // Width / Height: 0 means 256+ in ICO format.
    const w = size >= 256 ? 0 : size;
    const h = size >= 256 ? 0 : size;
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit depth
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buf.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(numImages, 4);

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(p => p.buf)]);
}

async function main() {
  console.log('Building SeeVibe logo assets…');

  // 1. Standalone SVG for modern browsers (favicon.svg).
  const faviconSvgPath = path.join(ROOT, 'public', 'favicon.svg');
  await fs.writeFile(faviconSvgPath, LOGO_SVG, 'utf8');
  console.log('  ✓ public/favicon.svg');

  // 2. 512×512 PNG (OG / Twitter / app launcher).
  const png512Path = path.join(ROOT, 'public', 'logo-512.png');
  await sharp(Buffer.from(LOGO_SVG)).resize(512, 512).png().toFile(png512Path);
  console.log('  ✓ public/logo-512.png');

  // 3. 192×192 PNG (PWA / manifest).
  const png192Path = path.join(ROOT, 'public', 'logo-192.png');
  await sharp(Buffer.from(LOGO_SVG)).resize(192, 192).png().toFile(png192Path);
  console.log('  ✓ public/logo-192.png');

  // 4. Multi-size favicon.ico (16, 32, 48, 64, 128, 256).
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers: Array<{ size: number; buf: Buffer }> = [];
  for (const s of sizes) {
    const buf = await sharp(Buffer.from(LOGO_SVG))
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push({ size: s, buf });
  }
  const icoBuf = await buildIco(pngBuffers);
  const icoPath = path.join(ROOT, 'public', 'favicon.ico');
  await fs.writeFile(icoPath, icoBuf);
  console.log(`  ✓ public/favicon.ico (${sizes.join(', ')} — ${(icoBuf.length / 1024).toFixed(1)} KB)`);

  // 5. Apple Touch Icon (180×180, no transparency).
  const applePath = path.join(ROOT, 'public', 'apple-touch-icon.png');
  await sharp(Buffer.from(LOGO_SVG))
    .resize(180, 180)
    .flatten({ background: { r: 8, g: 8, b: 11 } })
    .png()
    .toFile(applePath);
  console.log('  ✓ public/apple-touch-icon.png');

  // 6. Preserve the original source JPG.
  const jpgOutPath = path.join(ROOT, 'public', 'logo-source.jpg');
  await fs.copyFile(SOURCE_JPG, jpgOutPath);
  console.log('  ✓ public/logo-source.jpg');

  console.log('Done.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});