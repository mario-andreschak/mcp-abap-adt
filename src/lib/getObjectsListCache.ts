// In-memory cache for GetObjectsList

type ObjectsListCacheType = any | null;

class ObjectsListCache {
    private cache: ObjectsListCacheType = null;

    setCache(data: any) {
        this.cache = data;
    }

    getCache(): ObjectsListCacheType {
        return this.cache;
    }

    clearCache() {
        this.cache = null;
    }
}

export const objectsListCache = new ObjectsListCache();
