// Простий файловий кеш для GetFullCode

import * as fs from 'fs';
import * as path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.getfullcode.cache.json');

export function saveFullCodeCache(data: any) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadFullCodeCache(): any | null {
    if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return null;
}
