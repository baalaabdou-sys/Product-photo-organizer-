/**
 * The app mark: A and F set as one monogram, with the counter of the A and
 * the arms of the F reading as branches. No clip-art tree.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const mark = ({ bg, ink, gold, inset }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${inset ? 0 : 112}" fill="${bg}"/>
  <g transform="translate(256 ${inset ? 234 : 231}) scale(${inset ? 0.95 : 1.14})">
    <!-- The branch: a trunk that forks, its tips lit. -->
    <g stroke="${gold}" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.95">
      <path d="M0 74 L0 40"/>
      <path d="M0 40 C0 6 -46 2 -78 -30"/>
      <path d="M0 40 C0 6 46 2 78 -30"/>
      <path d="M-78 -30 C-104 -58 -126 -72 -150 -86"/>
      <path d="M-78 -30 C-78 -62 -66 -84 -54 -110"/>
      <path d="M78 -30 C104 -58 126 -72 150 -86"/>
      <path d="M78 -30 C78 -62 66 -84 54 -110"/>
    </g>
    <g fill="${gold}">
      <circle cx="-150" cy="-86" r="10"/>
      <circle cx="-54" cy="-110" r="10"/>
      <circle cx="150" cy="-86" r="10"/>
      <circle cx="54" cy="-110" r="10"/>
      <circle cx="0" cy="40" r="9"/>
    </g>
    <!-- AF, the crossbars doubling as the lowest branches. -->
    <text x="0" y="150" text-anchor="middle"
      font-family="Iowan Old Style, Palatino, Georgia, serif"
      font-size="112" font-weight="400" letter-spacing="12" fill="${ink}">AF</text>
  </g>
</svg>`;

const light = mark({ bg: '#f8f4ec', ink: '#221b17', gold: '#a48244', inset: false });
const maskable = mark({ bg: '#f8f4ec', ink: '#221b17', gold: '#a48244', inset: true });

await mkdir(out, { recursive: true });
await writeFile(join(out, 'icon.svg'), light);

for (const size of [192, 512]) {
  await sharp(Buffer.from(light)).resize(size, size).png().toFile(join(out, `icon-${size}.png`));
  await sharp(Buffer.from(maskable)).resize(size, size).png().toFile(join(out, `maskable-${size}.png`));
}
await sharp(Buffer.from(light)).resize(180, 180).png().toFile(join(out, 'apple-touch-icon.png'));
await sharp(Buffer.from(light)).resize(32, 32).png().toFile(join(out, 'favicon-32.png'));

console.log('icons written to', out);
