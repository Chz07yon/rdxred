/* RDX RED - Data & State Management (IndexedDB Version) */

const DB_NAME = 'rdx_db';
const DB_VERSION = 2;

// Stores
const STORE_MEDIA = 'media';
const STORE_STUDIOS = 'studios';
const STORE_MESSAGES = 'messages';

// Initial Mock Data
const INITIAL_MEDIA = [
    {
        id: 1,
        title: 'Cinematic Portrait',
        type: 'photo',
        category: 'Portrait',
        studio: 'Kokkada',
        url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80',
        date: '2025-01-10'
    },
    {
        id: 2,
        title: 'Wedding Highlights',
        type: 'video',
        category: 'Wedding',
        studio: 'Mysuru',
        thumbnail: 'https://images.unsplash.com/photo-1511285560982-1351cdeb9821?auto=format&fit=crop&q=80',
        url: '#',
        date: '2025-01-15'
    },
    {
        id: 3,
        title: 'Nature Series',
        type: 'photo',
        category: 'Nature',
        studio: 'Kokkada',
        url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80',
        date: '2025-01-20'
    },
    {
        id: 4,
        title: 'Urban Vibes',
        type: 'video',
        category: 'Commercial',
        studio: 'Mysuru',
        thumbnail: 'https://images.unsplash.com/photo-1552168324-d612d77725e3?auto=format&fit=crop&q=80',
        url: '#',
        date: '2025-02-01'
    }
];

const INITIAL_STUDIOS = {
    kokkada: { status: 'OPEN', coords: '12.86503395781084, 75.41327344291956' },
    mysuru: { status: 'OPEN', coords: '12.337992641858309, 76.61903412510877' }
};

// Internal DB Promise
let _dbPromise = null;

function openDB() {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create Object Stores if they don't exist
            if (!db.objectStoreNames.contains(STORE_MEDIA)) {
                db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_STUDIOS)) {
                db.createObjectStore(STORE_STUDIOS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
                db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject('Database error: ' + event.target.errorCode);
        };
    });
    return _dbPromise;
}

// Data Service
const DataService = {
    async init() {
        // Initialize DB and Seed if empty
        const db = await openDB();

        // Check Media
        const mediaCount = await this.count(STORE_MEDIA);
        if (mediaCount === 0) {
            console.log("Seeding Initial Media...");
            for (const item of INITIAL_MEDIA) {
                await this.addMedia(item);
            }
        }

        // Check Studios
        const allStudios = await this.getAll(STORE_STUDIOS);
        if (allStudios.length === 0) {
            console.log("Seeding Studios...");
            // Save normalized
            await this.put(STORE_STUDIOS, { id: 'kokkada', ...INITIAL_STUDIOS.kokkada });
            await this.put(STORE_STUDIOS, { id: 'mysuru', ...INITIAL_STUDIOS.mysuru });
        }
    },

    // --- Helpers ---
    async getTransaction(storeName, mode = 'readonly') {
        const db = await openDB();
        return db.transaction(storeName, mode).objectStore(storeName);
    },

    async getAll(storeName) {
        const store = await this.getTransaction(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, key) {
        const store = await this.getTransaction(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async put(storeName, item) {
        const store = await this.getTransaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, key) {
        const store = await this.getTransaction(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async count(storeName) {
        const store = await this.getTransaction(storeName);
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // --- Media ---
    async getMedia() {
        return await this.getAll(STORE_MEDIA);
    },

    async addMedia(item) {
        const { id: _ignore, ...rest } = item;
        const newItem = { id: Date.now(), ...rest };
        // Valid for both JSON objects and File/Blob handling (IDB supports Blobs directly)
        await this.put(STORE_MEDIA, newItem);
        return newItem;
    },

    async deleteMedia(id) {
        return await this.delete(STORE_MEDIA, id);
    },

    // --- Studios ---
    async getStudios() {
        const list = await this.getAll(STORE_STUDIOS);
        // Convert array back to object keys: { kokkada: {}, mysuru: {} }
        const map = {};
        list.forEach(s => {
            map[s.id] = s;
        });
        // Ensure defaults if missing (sanity check)
        if (!map.kokkada) map.kokkada = INITIAL_STUDIOS.kokkada;
        if (!map.mysuru) map.mysuru = INITIAL_STUDIOS.mysuru;
        return map;
    },

    async toggleStudioStatus(studioKey) {
        const studio = await this.get(STORE_STUDIOS, studioKey);
        if (studio) {
            studio.status = studio.status === 'OPEN' ? 'CLOSED' : 'OPEN';
            await this.put(STORE_STUDIOS, studio);
            return studio.status;
        }
        return null;
    },

    // --- Messages ---
    async addMessage(msg) {
        const newMsg = { id: Date.now(), ...msg, date: new Date().toISOString(), read: false };
        await this.put(STORE_MESSAGES, newMsg);
    },

    async getMessages() {
        return await this.getAll(STORE_MESSAGES);
    },

    async deleteMessage(id) {
        return await this.delete(STORE_MESSAGES, id);
    }
};

// Auto-init
DataService.init();
