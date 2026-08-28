import fs from 'fs';
import path from 'path';
import { ScanItem } from './modules/BaseModule';

const MAX_SCAN_ITEMS = 500000;

export function assertScanItems(value: unknown): asserts value is ScanItem[] {
    if (!Array.isArray(value) || value.length > MAX_SCAN_ITEMS) {
        throw new Error('Invalid cleanup item list.');
    }

    for (const item of value) {
        if (!item || typeof item !== 'object') throw new Error('Invalid cleanup item.');
        const candidate = item as Partial<ScanItem>;
        if (typeof candidate.id !== 'string' || !candidate.id ||
            typeof candidate.path !== 'string' || !candidate.path ||
            typeof candidate.name !== 'string' ||
            typeof candidate.category !== 'string' ||
            typeof candidate.selected !== 'boolean' ||
            typeof candidate.size !== 'number' || !Number.isFinite(candidate.size) || candidate.size < 0) {
            throw new Error('Invalid cleanup item data.');
        }
    }
}

export function assertScanId(scanId: unknown): asserts scanId is number {
    if (typeof scanId !== 'number' || !Number.isSafeInteger(scanId) || scanId <= 0) {
        throw new Error('A valid scan ID is required.');
    }
}

export function canonicalizePath(p: string): string {
    let resolved = path.resolve(p);
    try {
        if (fs.existsSync(resolved)) {
            resolved = fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
        } else {
            // Expand 8.3 short paths (e.g. MUHAMM~1) by resolving nearest existing ancestor
            let current = resolved;
            let suffix = '';
            while (current && !fs.existsSync(current)) {
                const parent = path.dirname(current);
                if (parent === current) break;
                suffix = path.join(path.basename(current), suffix);
                current = parent;
            }
            if (fs.existsSync(current)) {
                const realParent = fs.realpathSync.native ? fs.realpathSync.native(current) : fs.realpathSync(current);
                resolved = path.join(realParent, suffix);
            }
        }
    } catch {
        // fallback
    }
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isPathWithin(child: string, parent: string): boolean {
    const normParent = canonicalizePath(parent);
    const normChild = canonicalizePath(child);
    const relative = path.relative(normParent, normChild);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export async function assertSafeFile(filePath: string, allowedRoot: string): Promise<void> {
    if (!isPathWithin(filePath, allowedRoot)) throw new Error('Path is outside the permitted cleanup directory.');
    const stat = await fs.promises.lstat(filePath);
    if (!stat.isFile()) throw new Error('Only regular files can be cleaned.');
}

export async function assertSafeFileInRoots(filePath: string, allowedRoots: string[]): Promise<void> {
    const isInside = allowedRoots.some(root => isPathWithin(filePath, root));
    if (!isInside) throw new Error('Path is outside the permitted cleanup directories.');
    const stat = await fs.promises.lstat(filePath);
    if (!stat.isFile()) throw new Error('Only regular files can be cleaned.');
}

export function assertExistingDirectory(directory: string): void {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('A valid absolute directory is required.');
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) throw new Error('Directory does not exist.');
}

export function quotePowerShell(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}
