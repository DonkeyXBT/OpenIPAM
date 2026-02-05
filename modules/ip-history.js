const IPHistory = {
    MAX_ENTRIES_PER_IP: 100,
    record(ipAddress, action, data) {
        const history = DB.get(DB.KEYS.IP_HISTORY);
        const entry = {
            id: DB.generateId(),
            ipAddress,
            action, 
            timestamp: new Date().toISOString(),
            hostId: data.hostId || null,
            hostName: data.hostName || null,
            subnetId: data.subnetId || null,
            previousHostId: data.previousHostId || null,
            previousHostName: data.previousHostName || null,
            dnsName: data.dnsName || null,
            macAddress: data.macAddress || null,
            notes: data.notes || '',
            userId: data.userId || 'system'
        };
        history.unshift(entry);
        const ipEntries = {};
        const trimmed = history.filter(h => {
            if (!ipEntries[h.ipAddress]) {
                ipEntries[h.ipAddress] = 0;
            }
            ipEntries[h.ipAddress]++;
            return ipEntries[h.ipAddress] <= this.MAX_ENTRIES_PER_IP;
        });
        DB.set(DB.KEYS.IP_HISTORY, trimmed);
        return entry;
    },
    getByIP(ipAddress, limit = 50) {
        const history = DB.get(DB.KEYS.IP_HISTORY);
        return history.filter(h => h.ipAddress === ipAddress).slice(0, limit);
    },
    getByHost(hostId, limit = 50) {
        const history = DB.get(DB.KEYS.IP_HISTORY);
        return history.filter(h => h.hostId === hostId || h.previousHostId === hostId).slice(0, limit);
    },
    getBySubnet(subnetId, limit = 100) {
        const history = DB.get(DB.KEYS.IP_HISTORY);
        return history.filter(h => h.subnetId === subnetId).slice(0, limit);
    },
    getRecent(limit = 100) {
        const history = DB.get(DB.KEYS.IP_HISTORY);
        return history.slice(0, limit);
    },
    getAssignmentTimeline(ipAddress) {
        const history = this.getByIP(ipAddress, 100);
        const timeline = [];
        let currentAssignment = null;
        for (let i = history.length - 1; i >= 0; i--) {
            const entry = history[i];
            if (entry.action === 'assigned') {
                currentAssignment = {
                    hostId: entry.hostId,
                    hostName: entry.hostName,
                    startDate: entry.timestamp,
                    endDate: null
                };
            } else if (entry.action === 'released' && currentAssignment) {
                currentAssignment.endDate = entry.timestamp;
                timeline.push({ ...currentAssignment });
                currentAssignment = null;
            }
        }
        if (currentAssignment) {
            timeline.push(currentAssignment);
        }
        return timeline.reverse();
    },
    getStats() {
        const history = DB.get(DB.KEYS.IP_HISTORY);
        const uniqueIPs = new Set(history.map(h => h.ipAddress)).size;
        const assignments = history.filter(h => h.action === 'assigned').length;
        const releases = history.filter(h => h.action === 'released').length;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentActivity = history.filter(h => new Date(h.timestamp) >= thirtyDaysAgo);
        return {
            totalEntries: history.length,
            uniqueIPs,
            totalAssignments: assignments,
            totalReleases: releases,
            recentActivity: recentActivity.length
        };
    },
    clear() {
        DB.set(DB.KEYS.IP_HISTORY, []);
    }
};
