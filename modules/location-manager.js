const LocationManager = {
    getAll() {
        return DB.get(DB.KEYS.LOCATIONS);
    },
    getById(id) {
        const locations = DB.get(DB.KEYS.LOCATIONS);
        return locations.find(l => l.id === id);
    },
    getDatacenters() {
        const locations = this.getAll();
        return [...new Set(locations.map(l => l.datacenter).filter(Boolean))];
    },
    getBuildings(datacenter = null) {
        const locations = this.getAll();
        const filtered = datacenter ? locations.filter(l => l.datacenter === datacenter) : locations;
        return [...new Set(filtered.map(l => l.building).filter(Boolean))];
    },
    getRooms(datacenter = null, building = null) {
        let locations = this.getAll();
        if (datacenter) locations = locations.filter(l => l.datacenter === datacenter);
        if (building) locations = locations.filter(l => l.building === building);
        return [...new Set(locations.map(l => l.room).filter(Boolean))];
    },
    getRacks(datacenter = null, building = null, room = null) {
        let locations = this.getAll();
        if (datacenter) locations = locations.filter(l => l.datacenter === datacenter);
        if (building) locations = locations.filter(l => l.building === building);
        if (room) locations = locations.filter(l => l.room === room);
        return locations.filter(l => l.type === 'rack');
    },
    add(data) {
        const locations = DB.get(DB.KEYS.LOCATIONS);
        const newLocation = {
            id: DB.generateId(),
            type: data.type || 'rack', 
            name: data.name,
            datacenter: data.datacenter || '',
            building: data.building || '',
            room: data.room || '',
            rackUnits: parseInt(data.rackUnits) || 42,
            description: data.description || '',
            address: data.address || '',
            contactName: data.contactName || '',
            contactPhone: data.contactPhone || '',
            contactEmail: data.contactEmail || '',
            createdAt: new Date().toISOString()
        };
        locations.push(newLocation);
        DB.set(DB.KEYS.LOCATIONS, locations);
        AuditLog.log('create', 'location', newLocation.id,
            `Created location: ${newLocation.name}`, null, newLocation);
        return { success: true, location: newLocation };
    },
    update(id, updates) {
        const locations = DB.get(DB.KEYS.LOCATIONS);
        const index = locations.findIndex(l => l.id === id);
        if (index === -1) {
            return { success: false, message: 'Location not found' };
        }
        const oldLocation = { ...locations[index] };
        locations[index] = { ...locations[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.LOCATIONS, locations);
        AuditLog.log('update', 'location', id,
            `Updated location: ${locations[index].name}`, oldLocation, locations[index]);
        return { success: true, location: locations[index] };
    },
    delete(id) {
        const locations = DB.get(DB.KEYS.LOCATIONS);
        const location = locations.find(l => l.id === id);
        if (!location) {
            return { success: false, message: 'Location not found' };
        }
        const hosts = DB.get(DB.KEYS.HOSTS);
        const hostsUsingLocation = hosts.filter(h => h.locationId === id);
        if (hostsUsingLocation.length > 0) {
            return { success: false, message: `Cannot delete: ${hostsUsingLocation.length} hosts are in this location` };
        }
        const filtered = locations.filter(l => l.id !== id);
        DB.set(DB.KEYS.LOCATIONS, filtered);
        AuditLog.log('delete', 'location', id,
            `Deleted location: ${location.name}`, location, null);
        return { success: true };
    },
    getHostsInRack(rackId) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        return hosts.filter(h => h.locationId === rackId).sort((a, b) => (a.uPosition || 0) - (b.uPosition || 0));
    },
    getRackUtilization(rackId) {
        const rack = this.getById(rackId);
        if (!rack) return null;
        const hosts = this.getHostsInRack(rackId);
        const usedUnits = hosts.reduce((sum, h) => sum + (h.uHeight || 1), 0);
        const totalUnits = rack.rackUnits || 42;
        return {
            total: totalUnits,
            used: usedUnits,
            available: totalUnits - usedUnits,
            percentage: Math.round((usedUnits / totalUnits) * 100)
        };
    },
    getRackVisualization(rackId) {
        const rack = this.getById(rackId);
        if (!rack) return null;
        const hosts = this.getHostsInRack(rackId);
        const totalUnits = rack.rackUnits || 42;
        const units = [];
        for (let i = totalUnits; i >= 1; i--) {
            const hostInUnit = hosts.find(h => {
                const startU = h.uPosition || 0;
                const height = h.uHeight || 1;
                return i >= startU && i < startU + height;
            });
            units.push({
                position: i,
                host: hostInUnit || null,
                isStartUnit: hostInUnit ? hostInUnit.uPosition === i : false
            });
        }
        return { rack, units, hosts };
    }
};
