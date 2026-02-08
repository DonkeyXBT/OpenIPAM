const DB = {
    KEYS: {
        COMPANIES: 'ipdb_companies',
        SUBNETS: 'ipdb_subnets',
        HOSTS: 'ipdb_hosts',
        IPS: 'ipdb_ips',
        VLANS: 'ipdb_vlans',
        IP_RANGES: 'ipdb_ip_ranges',
        SUBNET_TEMPLATES: 'ipdb_subnet_templates',
        RESERVATIONS: 'ipdb_reservations',
        AUDIT_LOG: 'ipdb_audit_log',
        SETTINGS: 'ipdb_settings',
        IP_HISTORY: 'ipdb_ip_history',
        MAINTENANCE_WINDOWS: 'ipdb_maintenance_windows',
        LOCATIONS: 'ipdb_locations',
        SAVED_FILTERS: 'ipdb_saved_filters'
    },

    _db: null,
    _saveTimer: null,
    _migrating: false,

    _tableMap: {
        'ipdb_companies': 'companies',
        'ipdb_subnets': 'subnets',
        'ipdb_hosts': 'hosts',
        'ipdb_ips': 'ips',
        'ipdb_vlans': 'vlans',
        'ipdb_ip_ranges': 'ip_ranges',
        'ipdb_subnet_templates': 'subnet_templates',
        'ipdb_reservations': 'reservations',
        'ipdb_audit_log': 'audit_log',
        'ipdb_ip_history': 'ip_history',
        'ipdb_maintenance_windows': 'maintenance_windows',
        'ipdb_locations': 'locations',
        'ipdb_saved_filters': 'saved_filters'
    },

    _jsonColumns: {
        'subnet_templates': ['ranges', 'reservations'],
        'maintenance_windows': ['hostIds', 'subnetIds'],
        'saved_filters': ['filters'],
        'audit_log': ['oldValue', 'newValue']
    },

    _blobTables: new Set(['reservations']),

    _createTableSQL: [
        `CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT,
            code TEXT,
            contact TEXT,
            email TEXT,
            color TEXT,
            notes TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS subnets (
            id TEXT PRIMARY KEY,
            companyId TEXT,
            network TEXT,
            cidr INTEGER,
            name TEXT,
            description TEXT,
            vlanId TEXT,
            gateway TEXT,
            dnsServers TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS hosts (
            id TEXT PRIMARY KEY,
            companyId TEXT,
            vmName TEXT,
            hostType TEXT DEFAULT 'vm',
            description TEXT,
            serialNumber TEXT,
            operatingSystem TEXT,
            memoryUsedGB REAL,
            memoryAvailableGB REAL,
            memoryTotalGB REAL,
            node TEXT,
            diskSizeGB REAL,
            diskUsedGB REAL,
            state TEXT,
            cpuCount INTEGER,
            favorite INTEGER DEFAULT 0,
            purchaseDate TEXT,
            warrantyExpiry TEXT,
            eolDate TEXT,
            lifecycleStatus TEXT,
            vendor TEXT,
            model TEXT,
            assetTag TEXT,
            location TEXT,
            locationId TEXT,
            uPosition INTEGER,
            uHeight INTEGER,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS ips (
            id TEXT PRIMARY KEY,
            ipAddress TEXT,
            subnetId TEXT,
            hostId TEXT,
            status TEXT DEFAULT 'available',
            reservationType TEXT,
            reservationDescription TEXT,
            dnsName TEXT,
            macAddress TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS vlans (
            id TEXT PRIMARY KEY,
            vlanId INTEGER,
            name TEXT,
            description TEXT,
            type TEXT,
            companyId TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS ip_ranges (
            id TEXT PRIMARY KEY,
            subnetId TEXT,
            startIP TEXT,
            endIP TEXT,
            purpose TEXT,
            name TEXT,
            description TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS subnet_templates (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            cidr INTEGER,
            vlanType TEXT,
            ranges TEXT,
            reservations TEXT,
            isBuiltIn INTEGER DEFAULT 0,
            isCustom INTEGER DEFAULT 0,
            createdAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS reservations (
            id TEXT PRIMARY KEY,
            json TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS maintenance_windows (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            type TEXT,
            status TEXT DEFAULT 'scheduled',
            startTime TEXT,
            endTime TEXT,
            hostIds TEXT,
            subnetIds TEXT,
            impact TEXT,
            notifyBefore INTEGER,
            recurring INTEGER DEFAULT 0,
            recurringPattern TEXT,
            notes TEXT,
            createdAt TEXT,
            createdBy TEXT,
            statusNotes TEXT,
            statusUpdatedAt TEXT,
            completedAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS locations (
            id TEXT PRIMARY KEY,
            type TEXT DEFAULT 'rack',
            name TEXT,
            datacenter TEXT,
            building TEXT,
            room TEXT,
            rackUnits INTEGER DEFAULT 42,
            description TEXT,
            address TEXT,
            contactName TEXT,
            contactPhone TEXT,
            contactEmail TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            action TEXT,
            entityType TEXT,
            entityId TEXT,
            details TEXT,
            oldValue TEXT,
            newValue TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS ip_history (
            id TEXT PRIMARY KEY,
            ipAddress TEXT,
            action TEXT,
            timestamp TEXT,
            hostId TEXT,
            hostName TEXT,
            subnetId TEXT,
            previousHostId TEXT,
            previousHostName TEXT,
            dnsName TEXT,
            macAddress TEXT,
            notes TEXT,
            userId TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS saved_filters (
            id TEXT PRIMARY KEY,
            name TEXT,
            page TEXT,
            filters TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`
    ],

    async init() {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/${file}`
            });

            const savedData = await this._loadFromIDB();
            if (savedData) {
                this._db = new SQL.Database(savedData);
                this._createTables();
                console.log('NetManager: SQLite loaded from IndexedDB');
            } else {
                this._db = new SQL.Database();
                this._createTables();
                const migrated = this._migrateFromLocalStorage();
                if (migrated) {
                    await this._persist();
                }
                console.log('NetManager: SQLite initialized' + (migrated ? ' (migrated from localStorage)' : ''));
            }
        } catch (e) {
            console.error('NetManager: SQLite init failed, using localStorage fallback', e);
            if (localStorage.getItem('ipdb_sqlite_migrated') === 'true') {
                console.warn('NetManager: Data was previously migrated to SQLite. localStorage data may be outdated.');
            }
            this._db = null;
        }
    },

    _createTables() {
        for (const sql of this._createTableSQL) {
            this._db.run(sql);
        }
    },

    get(key) {
        if (!this._db) {
            const data = localStorage.getItem(key);
            if (key === this.KEYS.SETTINGS) {
                return data ? JSON.parse(data) : {};
            }
            return data ? JSON.parse(data) : [];
        }

        if (key === this.KEYS.SETTINGS) {
            return this._getSettings();
        }

        const table = this._tableMap[key];
        if (!table) return [];

        if (this._blobTables.has(table)) {
            return this._getBlobTable(table);
        }

        try {
            const results = this._db.exec(`SELECT * FROM ${table}`);
            if (!results.length) return [];

            const columns = results[0].columns;
            const jsonCols = this._jsonColumns[table] || [];

            return results[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => {
                    let val = row[i];
                    if (val !== null && jsonCols.includes(col)) {
                        try { val = JSON.parse(val); } catch(e) {}
                    }
                    obj[col] = val;
                });
                return obj;
            });
        } catch (e) {
            console.error(`DB.get error for ${key}:`, e);
            return [];
        }
    },

    set(key, data) {
        if (!this._db) {
            localStorage.setItem(key, JSON.stringify(data));
            return;
        }

        if (key === this.KEYS.SETTINGS) {
            this._setSettings(data);
            return;
        }

        const table = this._tableMap[key];
        if (!table) return;

        if (this._blobTables.has(table)) {
            this._setBlobTable(table, data);
            return;
        }

        const jsonCols = this._jsonColumns[table] || [];

        try {
            this._db.run('BEGIN TRANSACTION');
            this._db.run(`DELETE FROM ${table}`);

            if (Array.isArray(data) && data.length > 0) {
                const tableInfo = this._db.exec(`PRAGMA table_info(${table})`);
                const validColumns = tableInfo[0].values.map(r => r[1]);

                for (const item of data) {
                    const cols = [];
                    const vals = [];
                    const placeholders = [];

                    for (const col of validColumns) {
                        if (col in item) {
                            cols.push(col);
                            let val = item[col];
                            if (val != null && jsonCols.includes(col)) {
                                val = JSON.stringify(val);
                            }
                            vals.push(val ?? null);
                            placeholders.push('?');
                        }
                    }

                    if (cols.length > 0) {
                        this._db.run(
                            `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders.join(',')})`,
                            vals
                        );
                    }
                }
            }

            this._db.run('COMMIT');
            this._scheduleSave();
        } catch (e) {
            try { this._db.run('ROLLBACK'); } catch(re) {}
            console.error(`DB.set error for ${key}:`, e);
        }
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    clearAll() {
        if (!this._db) {
            Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
            return;
        }
        for (const table of Object.values(this._tableMap)) {
            try { this._db.run(`DELETE FROM ${table}`); } catch(e) {}
        }
        try { this._db.run('DELETE FROM settings'); } catch(e) {}
        this._scheduleSave();
    },

    getStorageSize() {
        if (!this._db) {
            let total = 0;
            Object.values(this.KEYS).forEach(key => {
                const item = localStorage.getItem(key);
                if (item) total += item.length * 2;
            });
            return total;
        }
        try {
            const data = this._db.export();
            return data.length;
        } catch(e) {
            return 0;
        }
    },

    // --- Settings (key-value store) ---

    _getSettings() {
        try {
            const results = this._db.exec('SELECT key, value FROM settings');
            if (!results.length) return {};
            const obj = {};
            for (const row of results[0].values) {
                try { obj[row[0]] = JSON.parse(row[1]); }
                catch(e) { obj[row[0]] = row[1]; }
            }
            return obj;
        } catch(e) {
            return {};
        }
    },

    _setSettings(data) {
        if (!data || typeof data !== 'object') return;
        try {
            this._db.run('BEGIN TRANSACTION');
            this._db.run('DELETE FROM settings');
            for (const [key, value] of Object.entries(data)) {
                this._db.run('INSERT INTO settings (key, value) VALUES (?, ?)',
                    [key, JSON.stringify(value)]);
            }
            this._db.run('COMMIT');
            this._scheduleSave();
        } catch(e) {
            try { this._db.run('ROLLBACK'); } catch(re) {}
            console.error('DB._setSettings error:', e);
        }
    },

    // --- Blob tables (flexible schema, e.g. reservations) ---

    _getBlobTable(table) {
        try {
            const results = this._db.exec(`SELECT json FROM ${table}`);
            if (!results.length) return [];
            return results[0].values.map(row => {
                try { return JSON.parse(row[0]); }
                catch(e) { return {}; }
            });
        } catch(e) {
            return [];
        }
    },

    _setBlobTable(table, data) {
        try {
            this._db.run('BEGIN TRANSACTION');
            this._db.run(`DELETE FROM ${table}`);
            if (Array.isArray(data)) {
                for (const item of data) {
                    this._db.run(`INSERT INTO ${table} (id, json) VALUES (?, ?)`,
                        [item.id || this.generateId(), JSON.stringify(item)]);
                }
            }
            this._db.run('COMMIT');
            this._scheduleSave();
        } catch(e) {
            try { this._db.run('ROLLBACK'); } catch(re) {}
            console.error(`DB._setBlobTable error for ${table}:`, e);
        }
    },

    // --- IndexedDB persistence ---

    _scheduleSave() {
        if (this._migrating) return;
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._persist(), 500);
    },

    _persist() {
        if (!this._db) return Promise.resolve();
        try {
            const data = this._db.export();
            const buffer = new Uint8Array(data);
            return this._saveToIDB(buffer);
        } catch(e) {
            console.error('Failed to export SQLite DB:', e);
            return Promise.resolve();
        }
    },

    _loadFromIDB() {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('NetManagerDB', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('sqliteDb')) {
                        db.createObjectStore('sqliteDb');
                    }
                };
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('sqliteDb', 'readonly');
                    const store = tx.objectStore('sqliteDb');
                    const getReq = store.get('db');
                    getReq.onsuccess = () => {
                        db.close();
                        resolve(getReq.result || null);
                    };
                    getReq.onerror = () => {
                        db.close();
                        resolve(null);
                    };
                };
                request.onerror = () => resolve(null);
            } catch(e) {
                resolve(null);
            }
        });
    },

    _saveToIDB(data) {
        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('NetManagerDB', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('sqliteDb')) {
                        db.createObjectStore('sqliteDb');
                    }
                };
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('sqliteDb', 'readwrite');
                    const store = tx.objectStore('sqliteDb');
                    store.put(data, 'db');
                    tx.oncomplete = () => { db.close(); resolve(); };
                    tx.onerror = () => { db.close(); reject(tx.error); };
                };
                request.onerror = () => reject(request.error);
            } catch(e) {
                reject(e);
            }
        });
    },

    // --- Migration from localStorage ---

    _migrateFromLocalStorage() {
        this._migrating = true;
        let migrated = false;

        for (const lsKey of Object.values(this.KEYS)) {
            const raw = localStorage.getItem(lsKey);
            if (!raw) continue;

            try {
                const data = JSON.parse(raw);
                if (lsKey === this.KEYS.SETTINGS) {
                    if (typeof data === 'object' && !Array.isArray(data)) {
                        this._setSettings(data);
                        migrated = true;
                    }
                } else if (Array.isArray(data) && data.length > 0) {
                    this.set(lsKey, data);
                    migrated = true;
                }
            } catch(e) {
                console.warn(`Migration failed for ${lsKey}:`, e);
            }
        }

        // Migrate UI settings stored outside DB.KEYS
        const compactView = localStorage.getItem('ipdb_compactView');
        const hostColumns = localStorage.getItem('ipdb_hostColumns');
        if (compactView !== null || hostColumns !== null) {
            const settings = this._getSettings();
            if (compactView !== null) settings.compactView = compactView === 'true';
            if (hostColumns !== null) {
                try { settings.hostColumns = JSON.parse(hostColumns); } catch(e) {}
            }
            this._setSettings(settings);
            migrated = true;
        }

        this._migrating = false;

        if (migrated) {
            localStorage.setItem('ipdb_sqlite_migrated', 'true');
            console.log('NetManager: Data migrated from localStorage to SQLite');
        }

        return migrated;
    }
};
