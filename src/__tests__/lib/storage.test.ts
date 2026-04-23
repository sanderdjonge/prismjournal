import { describe, it, expect } from 'vitest';
import { generateFilename } from '@/lib/storage';

describe('generateFilename', () => {
    it('generates a filename matching the safe pattern', () => {
        const result = generateFilename('photo.png');
        expect(result).toMatch(/^\d+-[a-z0-9]+\.(png|jpg|jpeg|webp|gif)$/);
    });

    it('normalises extension to allowed types', () => {
        const result = generateFilename('exploit.php');
        expect(result).toMatch(/\.png$/);
    });

    it('normalises extension with no extension', () => {
        const result = generateFilename('noext');
        expect(result).toMatch(/\.png$/);
    });

    it('normalises .html extension', () => {
        const result = generateFilename('page.html');
        expect(result).toMatch(/\.png$/);
    });

    it('preserves allowed extensions', () => {
        expect(generateFilename('a.jpg')).toMatch(/\.jpg$/);
        expect(generateFilename('a.jpeg')).toMatch(/\.jpeg$/);
        expect(generateFilename('a.webp')).toMatch(/\.webp$/);
        expect(generateFilename('a.gif')).toMatch(/\.gif$/);
        expect(generateFilename('a.PNG')).toMatch(/\.png$/);
    });
});
