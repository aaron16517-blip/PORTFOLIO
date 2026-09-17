/* One-off generator for the Contact section's dotted world map.

   Run with `npm run map`. Writes public/assets/world-dots.svg, which is then
   a plain static asset — dotted-map is a BUILD-time dependency only and never
   ships to the browser.

   It also prints the pin's position as percentages. Those two numbers live in
   --pin-x / --pin-y in contact.css; change HOME below, re-run, paste them in. */
import { writeFileSync, mkdirSync } from 'node:fs';
import DottedMap from 'dotted-map';

/* where the pin sits — change this and re-run */
const HOME = { lat: 26.85, lng: 80.95 };   /* Lucknow, Uttar Pradesh */

const HEIGHT = 62;
const map = new DottedMap({ height: HEIGHT, grid: 'diagonal' });

const svg = map.getSVG({
  radius: 0.22,
  color: '#0F2220',            /* --ink, the same as the Contact us heading */
  shape: 'circle',
  backgroundColor: 'transparent'
});

mkdirSync('public/assets', { recursive: true });
writeFileSync('public/assets/world-dots.svg', svg);

/* the viewBox dotted-map emits is "0 0 <width> <height>" */
const [, , vbW, vbH] = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
const pin = map.getPin(HOME);

console.log('world-dots.svg —', (svg.length / 1024).toFixed(1), 'KB');
console.log('paste into contact.css:');
console.log(`  --pin-x: ${((pin.x / vbW) * 100).toFixed(2)}%;`);
console.log(`  --pin-y: ${((pin.y / vbH) * 100).toFixed(2)}%;`);
