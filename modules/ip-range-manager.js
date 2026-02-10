const IPRangeManager = {
    getAll() {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const ips = DB.get(DB.KEYS.IPS);
        return ranges.map(range => {
            const subnet = subnets.find(s => s.id === range.subnetId);
            const purpose = RANGE_PURPOSES.find(p => p.id === range.purpose) || RANGE_PURPOSES.find(p => p.id === 'reserved');
            const startInt = IPUtils.ipToInt(range.startIP);
            const endInt = IPUtils.ipToInt(range.endIP);
            const totalIPs = endInt - startInt + 1;
            const usedIPs = ips.filter(ip => {
                const ipInt = IPUtils.ipToInt(ip.ipAddress);
                return ipInt >= startInt && ipInt <= endInt && ip.status !== 'available';
            }).length;
            return {
                ...range,
                subnetName: subnet ? `${subnet.network}/${subnet.cidr}` : 'Unknown',
                subnetNetwork: subnet?.network,
                subnetCidr: subnet?.cidr,
                purposeName: purpose.name,
                purposeIcon: purpose.icon,
                purposeColor: purpose.color,
                totalIPs,
                usedIPs,
                availableIPs: totalIPs - usedIPs
            };
        });
    },
    getBySubnetId(subnetId) {
        return this.getAll().filter(r => r.subnetId === subnetId);
    },
    getById(id) {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        return ranges.find(r => r.id === id);
    },
    add(data) {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        if (!IPUtils.isValidIP(data.startIP) || !IPUtils.isValidIP(data.endIP)) {
            return { success: false, message: 'Invalid IP address' };
        }
        const startInt = IPUtils.ipToInt(data.startIP);
        const endInt = IPUtils.ipToInt(data.endIP);
        if (startInt > endInt) {
            return { success: false, message: 'Start IP must be before End IP' };
        }
        const existingRanges = ranges.filter(r => r.subnetId === data.subnetId);
        for (const existing of existingRanges) {
            const exStartInt = IPUtils.ipToInt(existing.startIP);
            const exEndInt = IPUtils.ipToInt(existing.endIP);
            if ((startInt >= exStartInt && startInt <= exEndInt) ||
                (endInt >= exStartInt && endInt <= exEndInt) ||
                (startInt <= exStartInt && endInt >= exEndInt)) {
                return { success: false, message: 'IP range overlaps with existing range' };
            }
        }
        const newRange = {
            id: DB.generateId(),
            subnetId: data.subnetId,
            startIP: data.startIP,
            endIP: data.endIP,
            purpose: data.purpose || 'other',
            name: data.name || '',
            description: data.description || '',
            createdAt: new Date().toISOString()
        };
        ranges.push(newRange);
        DB.set(DB.KEYS.IP_RANGES, ranges);
        AuditLog.log('create', 'ip_range', newRange.id,
            `Created IP range: ${newRange.startIP} - ${newRange.endIP}${newRange.name ? ' (' + newRange.name + ')' : ''}`, null, newRange);
        return { success: true, message: 'IP range added successfully', range: newRange };
    },
    update(id, updates) {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        const index = ranges.findIndex(r => r.id === id);
        if (index === -1) {
            return { success: false, message: 'IP range not found' };
        }
        const oldRange = { ...ranges[index] };
        ranges[index] = { ...ranges[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.IP_RANGES, ranges);
        AuditLog.log('update', 'ip_range', id,
            `Updated IP range: ${ranges[index].startIP} - ${ranges[index].endIP}`, oldRange, ranges[index]);
        return { success: true, message: 'IP range updated successfully' };
    },
    delete(id) {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        const range = ranges.find(r => r.id === id);
        const newRanges = ranges.filter(r => r.id !== id);
        DB.set(DB.KEYS.IP_RANGES, newRanges);
        AuditLog.log('delete', 'ip_range', id,
            `Deleted IP range: ${range ? range.startIP + ' - ' + range.endIP : id}`, range, null);
        return { success: true, message: 'IP range deleted successfully' };
    }
};
