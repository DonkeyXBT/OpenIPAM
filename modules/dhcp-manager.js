const DHCPManager = {
    // === Scopes ===
    getAllScopes() {
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const leases = DB.get(DB.KEYS.DHCP_LEASES);
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS);
        return scopes.map(scope => {
            const subnet = subnets.find(s => s.id === scope.subnetId);
            const scopeLeases = leases.filter(l => l.scopeId === scope.id);
            const scopeReservations = reservations.filter(r => r.scopeId === scope.id);
            const startInt = IPUtils.ipToInt(scope.startIP);
            const endInt = IPUtils.ipToInt(scope.endIP);
            const totalIPs = endInt - startInt + 1;
            const activeLeases = scopeLeases.filter(l => l.status === 'active').length;
            const reservedCount = scopeReservations.length;
            const used = activeLeases + reservedCount;
            return {
                ...scope,
                subnetName: subnet ? `${subnet.network}/${subnet.cidr}` : 'Unknown',
                totalIPs,
                activeLeases,
                reservedCount,
                used,
                available: Math.max(0, totalIPs - used),
                utilization: totalIPs > 0 ? Math.round((used / totalIPs) * 100) : 0
            };
        });
    },

    getScopeById(id) {
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        return scopes.find(s => s.id === id);
    },

    getScopesBySubnet(subnetId) {
        return this.getAllScopes().filter(s => s.subnetId === subnetId);
    },

    addScope(data) {
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        if (!IPUtils.isValidIP(data.startIP) || !IPUtils.isValidIP(data.endIP)) {
            return { success: false, message: 'Invalid IP address' };
        }
        const startInt = IPUtils.ipToInt(data.startIP);
        const endInt = IPUtils.ipToInt(data.endIP);
        if (startInt > endInt) {
            return { success: false, message: 'Start IP must be before End IP' };
        }
        // Check for overlap with existing scopes in same subnet
        const existingScopes = scopes.filter(s => s.subnetId === data.subnetId);
        for (const existing of existingScopes) {
            const exStartInt = IPUtils.ipToInt(existing.startIP);
            const exEndInt = IPUtils.ipToInt(existing.endIP);
            if ((startInt >= exStartInt && startInt <= exEndInt) ||
                (endInt >= exStartInt && endInt <= exEndInt) ||
                (startInt <= exStartInt && endInt >= exEndInt)) {
                return { success: false, message: 'DHCP scope overlaps with existing scope' };
            }
        }
        const newScope = {
            id: DB.generateId(),
            name: data.name || '',
            subnetId: data.subnetId,
            startIP: data.startIP,
            endIP: data.endIP,
            leaseTime: parseInt(data.leaseTime) || 86400,
            dns: data.dns || '',
            gateway: data.gateway || '',
            domain: data.domain || '',
            enabled: data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };
        scopes.push(newScope);
        DB.set(DB.KEYS.DHCP_SCOPES, scopes);
        AuditLog.log('create', 'dhcp_scope', newScope.id,
            `Created DHCP scope: ${newScope.name || newScope.startIP + ' - ' + newScope.endIP}`, null, newScope);
        return { success: true, message: 'DHCP scope added successfully', scope: newScope };
    },

    updateScope(id, updates) {
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        const index = scopes.findIndex(s => s.id === id);
        if (index === -1) return { success: false, message: 'Scope not found' };
        const oldScope = { ...scopes[index] };
        if (updates.enabled !== undefined) {
            updates.enabled = updates.enabled ? 1 : 0;
        }
        scopes[index] = { ...scopes[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.DHCP_SCOPES, scopes);
        AuditLog.log('update', 'dhcp_scope', id,
            `Updated DHCP scope: ${scopes[index].name || id}`, oldScope, scopes[index]);
        return { success: true, message: 'DHCP scope updated successfully' };
    },

    deleteScope(id) {
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        const scope = scopes.find(s => s.id === id);
        // Cascade delete leases, reservations, and options
        const leases = DB.get(DB.KEYS.DHCP_LEASES).filter(l => l.scopeId !== id);
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS).filter(r => r.scopeId !== id);
        const options = DB.get(DB.KEYS.DHCP_OPTIONS).filter(o => o.scopeId !== id);
        DB.set(DB.KEYS.DHCP_LEASES, leases);
        DB.set(DB.KEYS.DHCP_RESERVATIONS, reservations);
        DB.set(DB.KEYS.DHCP_OPTIONS, options);
        const newScopes = scopes.filter(s => s.id !== id);
        DB.set(DB.KEYS.DHCP_SCOPES, newScopes);
        AuditLog.log('delete', 'dhcp_scope', id,
            `Deleted DHCP scope: ${scope ? scope.name || scope.startIP + ' - ' + scope.endIP : id}`, scope, null);
        return { success: true, message: 'DHCP scope deleted successfully' };
    },

    getScopeUtilization(scopeId) {
        const scope = this.getScopeById(scopeId);
        if (!scope) return null;
        const leases = DB.get(DB.KEYS.DHCP_LEASES).filter(l => l.scopeId === scopeId);
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS).filter(r => r.scopeId === scopeId);
        const startInt = IPUtils.ipToInt(scope.startIP);
        const endInt = IPUtils.ipToInt(scope.endIP);
        const totalIPs = endInt - startInt + 1;
        const activeLeases = leases.filter(l => l.status === 'active').length;
        const reservedCount = reservations.length;
        return {
            total: totalIPs,
            activeLeases,
            reserved: reservedCount,
            used: activeLeases + reservedCount,
            available: Math.max(0, totalIPs - activeLeases - reservedCount),
            percentage: totalIPs > 0 ? Math.round(((activeLeases + reservedCount) / totalIPs) * 100) : 0
        };
    },

    // === Leases ===
    getLeases(scopeId) {
        const leases = DB.get(DB.KEYS.DHCP_LEASES);
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        const filtered = scopeId ? leases.filter(l => l.scopeId === scopeId) : leases;
        return filtered.map(lease => {
            const scope = scopes.find(s => s.id === lease.scopeId);
            return {
                ...lease,
                scopeName: scope ? (scope.name || scope.startIP + ' - ' + scope.endIP) : 'Unknown'
            };
        });
    },

    getAllLeases() {
        return this.getLeases(null);
    },

    addLease(data) {
        const leases = DB.get(DB.KEYS.DHCP_LEASES);
        if (!IPUtils.isValidIP(data.ipAddress)) {
            return { success: false, message: 'Invalid IP address' };
        }
        // Check IP is within scope range
        const scope = this.getScopeById(data.scopeId);
        if (!scope) return { success: false, message: 'Scope not found' };
        const ipInt = IPUtils.ipToInt(data.ipAddress);
        const startInt = IPUtils.ipToInt(scope.startIP);
        const endInt = IPUtils.ipToInt(scope.endIP);
        if (ipInt < startInt || ipInt > endInt) {
            return { success: false, message: 'IP address is not within the scope range' };
        }
        // Check for duplicate IP in same scope
        if (leases.some(l => l.scopeId === data.scopeId && l.ipAddress === data.ipAddress && l.status === 'active')) {
            return { success: false, message: 'An active lease already exists for this IP in this scope' };
        }
        const newLease = {
            id: DB.generateId(),
            scopeId: data.scopeId,
            ipAddress: data.ipAddress,
            macAddress: data.macAddress || '',
            hostname: data.hostname || '',
            status: data.status || 'active',
            startTime: data.startTime || new Date().toISOString(),
            endTime: data.endTime || '',
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };
        leases.push(newLease);
        DB.set(DB.KEYS.DHCP_LEASES, leases);
        AuditLog.log('create', 'dhcp_lease', newLease.id,
            `Created DHCP lease: ${newLease.ipAddress} (${newLease.hostname || newLease.macAddress})`, null, newLease);
        return { success: true, message: 'DHCP lease added successfully', lease: newLease };
    },

    updateLease(id, updates) {
        const leases = DB.get(DB.KEYS.DHCP_LEASES);
        const index = leases.findIndex(l => l.id === id);
        if (index === -1) return { success: false, message: 'Lease not found' };
        const oldLease = { ...leases[index] };
        leases[index] = { ...leases[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.DHCP_LEASES, leases);
        AuditLog.log('update', 'dhcp_lease', id,
            `Updated DHCP lease: ${leases[index].ipAddress}`, oldLease, leases[index]);
        return { success: true, message: 'DHCP lease updated successfully' };
    },

    deleteLease(id) {
        const leases = DB.get(DB.KEYS.DHCP_LEASES);
        const lease = leases.find(l => l.id === id);
        const newLeases = leases.filter(l => l.id !== id);
        DB.set(DB.KEYS.DHCP_LEASES, newLeases);
        AuditLog.log('delete', 'dhcp_lease', id,
            `Deleted DHCP lease: ${lease ? lease.ipAddress : id}`, lease, null);
        return { success: true, message: 'DHCP lease deleted successfully' };
    },

    getExpiredLeases() {
        const leases = DB.get(DB.KEYS.DHCP_LEASES);
        const now = new Date().toISOString();
        return leases.filter(l => l.status === 'active' && l.endTime && l.endTime < now);
    },

    // === Reservations ===
    getReservations(scopeId) {
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS);
        const scopes = DB.get(DB.KEYS.DHCP_SCOPES);
        const filtered = scopeId ? reservations.filter(r => r.scopeId === scopeId) : reservations;
        return filtered.map(res => {
            const scope = scopes.find(s => s.id === res.scopeId);
            return {
                ...res,
                scopeName: scope ? (scope.name || scope.startIP + ' - ' + scope.endIP) : 'Unknown'
            };
        });
    },

    addReservation(data) {
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS);
        if (!IPUtils.isValidIP(data.ipAddress)) {
            return { success: false, message: 'Invalid IP address' };
        }
        const scope = this.getScopeById(data.scopeId);
        if (!scope) return { success: false, message: 'Scope not found' };
        const ipInt = IPUtils.ipToInt(data.ipAddress);
        const startInt = IPUtils.ipToInt(scope.startIP);
        const endInt = IPUtils.ipToInt(scope.endIP);
        if (ipInt < startInt || ipInt > endInt) {
            return { success: false, message: 'IP address is not within the scope range' };
        }
        if (reservations.some(r => r.scopeId === data.scopeId && r.ipAddress === data.ipAddress)) {
            return { success: false, message: 'A reservation already exists for this IP in this scope' };
        }
        const newRes = {
            id: DB.generateId(),
            scopeId: data.scopeId,
            ipAddress: data.ipAddress,
            macAddress: data.macAddress || '',
            hostname: data.hostname || '',
            description: data.description || '',
            createdAt: new Date().toISOString()
        };
        reservations.push(newRes);
        DB.set(DB.KEYS.DHCP_RESERVATIONS, reservations);
        AuditLog.log('create', 'dhcp_reservation', newRes.id,
            `Created DHCP reservation: ${newRes.ipAddress} (${newRes.hostname || newRes.macAddress})`, null, newRes);
        return { success: true, message: 'DHCP reservation added successfully', reservation: newRes };
    },

    updateReservation(id, updates) {
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS);
        const index = reservations.findIndex(r => r.id === id);
        if (index === -1) return { success: false, message: 'Reservation not found' };
        const oldRes = { ...reservations[index] };
        reservations[index] = { ...reservations[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.DHCP_RESERVATIONS, reservations);
        AuditLog.log('update', 'dhcp_reservation', id,
            `Updated DHCP reservation: ${reservations[index].ipAddress}`, oldRes, reservations[index]);
        return { success: true, message: 'DHCP reservation updated successfully' };
    },

    deleteReservation(id) {
        const reservations = DB.get(DB.KEYS.DHCP_RESERVATIONS);
        const res = reservations.find(r => r.id === id);
        const newRes = reservations.filter(r => r.id !== id);
        DB.set(DB.KEYS.DHCP_RESERVATIONS, newRes);
        AuditLog.log('delete', 'dhcp_reservation', id,
            `Deleted DHCP reservation: ${res ? res.ipAddress : id}`, res, null);
        return { success: true, message: 'DHCP reservation deleted successfully' };
    },

    // === Options ===
    getOptions(scopeId) {
        const options = DB.get(DB.KEYS.DHCP_OPTIONS);
        return scopeId ? options.filter(o => o.scopeId === scopeId) : options;
    },

    addOption(data) {
        const options = DB.get(DB.KEYS.DHCP_OPTIONS);
        const newOption = {
            id: DB.generateId(),
            scopeId: data.scopeId,
            optionCode: parseInt(data.optionCode),
            optionName: data.optionName || '',
            optionValue: data.optionValue || '',
            createdAt: new Date().toISOString()
        };
        options.push(newOption);
        DB.set(DB.KEYS.DHCP_OPTIONS, options);
        return { success: true, message: 'DHCP option added successfully', option: newOption };
    },

    updateOption(id, updates) {
        const options = DB.get(DB.KEYS.DHCP_OPTIONS);
        const index = options.findIndex(o => o.id === id);
        if (index === -1) return { success: false, message: 'Option not found' };
        options[index] = { ...options[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.DHCP_OPTIONS, options);
        return { success: true, message: 'DHCP option updated successfully' };
    },

    deleteOption(id) {
        const options = DB.get(DB.KEYS.DHCP_OPTIONS);
        const newOptions = options.filter(o => o.id !== id);
        DB.set(DB.KEYS.DHCP_OPTIONS, newOptions);
        return { success: true, message: 'DHCP option deleted successfully' };
    }
};
