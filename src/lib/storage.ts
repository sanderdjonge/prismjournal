import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

// Storage directory - outside of public for security
const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
const SCREENSHOTS_DIR = path.join(STORAGE_ROOT, 'screenshots');

// Ensure storage directory exists
export async function ensureStorageDir(): Promise<void> {
    try {
        await access(SCREENSHOTS_DIR);
    } catch {
        await mkdir(SCREENSHOTS_DIR, { recursive: true });
    }
}

// Generate unique filename
export function generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase() || '.png';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}${ext}`;
}

// Save file to storage
export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
    await ensureStorageDir();
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await fs.promises.writeFile(filepath, buffer);
    return filepath;
}

// Delete file from storage
export async function deleteFile(filename: string): Promise<void> {
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    try {
        await unlink(filepath);
    } catch (error) {
        // File might not exist, ignore error
        console.warn(`Failed to delete file ${filename}:`, error);
    }
}

// Read file from storage
export async function readFile(filename: string): Promise<Buffer> {
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    return fs.promises.readFile(filepath);
}

// Check if file exists
export async function fileExists(filename: string): Promise<boolean> {
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    try {
        await access(filepath);
        return true;
    } catch {
        return false;
    }
}

// Get file stats
export async function getFileStats(filename: string): Promise<fs.Stats | null> {
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    try {
        return await fs.promises.stat(filepath);
    } catch {
        return null;
    }
}
