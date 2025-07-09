// Простий файловий кеш для GetObjectsList

import * as fs from 'fs';
import * as path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.getobjectslist.cache.json');

export function saveObjectsListCache(data: any) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadObjectsListCache(): any | null {
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

export function findNodeInCache(object_type: string, object_name: string, tech_name: string): any | null {
    const cache = loadObjectsListCache();
    if (!cache || !Array.isArray(cache.objects)) return null;
    return cache.objects.find(
        (obj: any) =>
            obj.OBJECT_TYPE === object_type &&
            obj.OBJECT_NAME === object_name &&
            obj.TECH_NAME === tech_name
    ) || null;
}

export function updateNodeInCache(object_type: string, object_name: string, tech_name: string, update: any) {
    const cache = loadObjectsListCache();
    if (!cache || !Array.isArray(cache.objects)) return;
    const idx = cache.objects.findIndex(
        (obj: any) =>
            obj.OBJECT_TYPE === object_type &&
            obj.OBJECT_NAME === object_name &&
            obj.TECH_NAME === tech_name
    );
    if (idx >= 0) {
        cache.objects[idx] = { ...cache.objects[idx], ...update };
        saveObjectsListCache(cache);
    }
}
