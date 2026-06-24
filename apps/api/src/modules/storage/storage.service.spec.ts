import sharp from 'sharp';
import { optimizeOgImageBuffer } from './storage.service';

describe('StorageService image optimization', () => {
  it('converts WEBP Open Graph uploads to a 1200x630 JPEG', async () => {
    const input = await sharp({
      create: {
        width: 900,
        height: 900,
        channels: 3,
        background: '#0f172a',
      },
    })
      .webp()
      .toBuffer();

    const output = await optimizeOgImageBuffer(input);
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
  });

  it('converts PNG Open Graph uploads to a 1200x630 JPEG', async () => {
    const input = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 4,
        background: '#f8fafc',
      },
    })
      .png()
      .toBuffer();

    const output = await optimizeOgImageBuffer(input);
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
  });
});
