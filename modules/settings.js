const Settings = {
    defaults: {
        darkMode: false,
        compactView: false,
        showAuditLog: true
    },
    get(key) {
        const settings = this.getAll();
        return settings[key] !== undefined ? settings[key] : this.defaults[key];
    },
    set(key, value) {
        const settings = this.getAll();
        settings[key] = value;
        localStorage.setItem(DB.KEYS.SETTINGS, JSON.stringify(settings));
        AuditLog.log('update', 'settings', key, `Changed ${key} to ${value}`);
    },
    getAll() {
        const stored = localStorage.getItem(DB.KEYS.SETTINGS);
        return stored ? JSON.parse(stored) : { ...this.defaults };
    },
    reset() {
        localStorage.setItem(DB.KEYS.SETTINGS, JSON.stringify(this.defaults));
    }
};
