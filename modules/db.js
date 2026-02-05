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

    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    clearAll() {
        Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    },

    getStorageSize() {
        let total = 0;
        Object.values(this.KEYS).forEach(key => {
            const item = localStorage.getItem(key);
            if (item) total += item.length * 2;
        });
        return total;
    }
};
