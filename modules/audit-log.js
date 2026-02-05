const AuditLog = {
    MAX_ENTRIES: 500,
    log(action, entityType, entityId, details, oldValue = null, newValue = null) {
        const logs = DB.get(DB.KEYS.AUDIT_LOG);
        const entry = {
            id: DB.generateId(),
            timestamp: new Date().toISOString(),
            action,
            entityType,
            entityId,
            details,
            oldValue,
            newValue
        };
        logs.unshift(entry);
        if (logs.length > this.MAX_ENTRIES) {
            logs.length = this.MAX_ENTRIES;
        }
        DB.set(DB.KEYS.AUDIT_LOG, logs);
        return entry;
    },
    getAll(limit = 100) {
        const logs = DB.get(DB.KEYS.AUDIT_LOG);
        return logs.slice(0, limit);
    },
    getByEntityType(entityType, limit = 50) {
        const logs = DB.get(DB.KEYS.AUDIT_LOG);
        return logs.filter(l => l.entityType === entityType).slice(0, limit);
    },
    getByEntity(entityType, entityId) {
        const logs = DB.get(DB.KEYS.AUDIT_LOG);
        return logs.filter(l => l.entityType === entityType && l.entityId === entityId);
    },
    clear() {
        DB.set(DB.KEYS.AUDIT_LOG, []);
    }
};
