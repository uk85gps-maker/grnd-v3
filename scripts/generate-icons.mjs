import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a" rx="80"/>
  <text x="256" y="340" font-family="Georgia, serif" font-size="280" font-weight="bold" 
    fill="#d4af37" text-anchor="middle">G</text>
</svg>`;

const svgBuffer = Buffer.from(svg);

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192x192.png');
await sharp(svgBuffer).resize(512, 512).png().toFile('public/icon-512x512.png');

console.log('Icons generated successfully');
