const IPManager = {
    getAll() {
        const ips = DB.get(DB.KEYS.IPS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const companies = DB.get(DB.KEYS.COMPANIES);
        return ips.map(ip => {
            const host = ip.hostId ? hosts.find(h => h.id === ip.hostId) : null;
            const subnet = ip.subnetId ? subnets.find(s => s.id === ip.subnetId) : null;
            const company = subnet?.companyId ? companies.find(c => c.id === subnet.companyId) : null;
            const reservationType = ip.reservationType ? RESERVATION_TYPES.find(t => t.id === ip.reservationType) : null;
            return {
                ...ip,
                hostName: host ? host.vmName : null,
                hostOS: host ? host.operatingSystem : null,
                hostState: host ? host.state : null,
                subnetName: subnet ? `${subnet.network}/${subnet.cidr}` : null,
                companyId: subnet?.companyId || null,
                companyName: company ? company.name : null,
                companyColor: company ? company.color : '#6b7280',
                reservationTypeName: reservationType?.name || null,
                reservationTypeIcon: reservationType?.icon || null,
                reservationTypeColor: reservationType?.color || null
            };
        });
    },
    getNextAvailable(subnetId) {
        const subnet = SubnetManager.getById(subnetId);
        if (!subnet) return null;
        const ips = DB.get(DB.KEYS.IPS);
        const usedIPs = new Set(
            ips.filter(ip => ip.subnetId === subnetId && ip.status !== 'available')
                .map(ip => ip.ipAddress)
        );
        const networkInt = IPUtils.ipToInt(subnet.network);
        const totalIPs = Math.pow(2, 32 - subnet.cidr);
        for (let i = 1; i < totalIPs - 1; i++) {
            const candidateIP = IPUtils.intToIp(networkInt + i);
            if (!usedIPs.has(candidateIP)) {
                return candidateIP;
            }
        }
        return null;
    },
    assign(ipAddress, hostId, subnetId = null) {
        if (!IPUtils.isValidIP(ipAddress)) {
            return { success: false, message: 'Invalid IP address' };
        }
        const ips = DB.get(DB.KEYS.IPS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const host = hosts.find(h => h.id === hostId);
        if (!subnetId) {
            const subnet = IPUtils.findSubnetForIP(ipAddress);
            if (subnet) subnetId = subnet.id;
        }
        const existingIndex = ips.findIndex(ip => ip.ipAddress === ipAddress);
        let previousHostId = null;
        let previousHostName = null;
        if (existingIndex !== -1) {
            if (ips[existingIndex].status === 'assigned' && ips[existingIndex].hostId !== hostId) {
                return { success: false, message: 'IP already assigned to another host' };
            }
            previousHostId = ips[existingIndex].hostId;
            if (previousHostId) {
                const prevHost = hosts.find(h => h.id === previousHostId);
                previousHostName = prevHost ? prevHost.vmName : null;
            }
            ips[existingIndex].hostId = hostId;
            ips[existingIndex].status = 'assigned';
            ips[existingIndex].subnetId = subnetId;
            ips[existingIndex].updatedAt = new Date().toISOString();
        } else {
            ips.push({
                id: DB.generateId(),
                ipAddress,
                subnetId,
                hostId,
                status: 'assigned',
                createdAt: new Date().toISOString()
            });
        }
        DB.set(DB.KEYS.IPS, ips);
        IPHistory.record(ipAddress, 'assigned', {
            hostId,
            hostName: host ? host.vmName : null,
            subnetId,
            previousHostId,
            previousHostName
        });
        return { success: true, message: 'IP assigned successfully' };
    },
    release(ipAddress) {
        const ips = DB.get(DB.KEYS.IPS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const index = ips.findIndex(ip => ip.ipAddress === ipAddress);
        if (index === -1) {
            return { success: false, message: 'IP not found' };
        }
        const previousHostId = ips[index].hostId;
        let previousHostName = null;
        if (previousHostId) {
            const prevHost = hosts.find(h => h.id === previousHostId);
            previousHostName = prevHost ? prevHost.vmName : null;
        }
        ips[index].hostId = null;
        ips[index].status = 'available';
        ips[index].updatedAt = new Date().toISOString();
        DB.set(DB.KEYS.IPS, ips);
        IPHistory.record(ipAddress, 'released', {
            subnetId: ips[index].subnetId,
            previousHostId,
            previousHostName
        });
        return { success: true, message: 'IP released successfully' };
    },
    register(ipAddress, hostId = null, status = 'assigned') {
        if (!IPUtils.isValidIP(ipAddress)) {
            return { success: false, message: 'Invalid IP address' };
        }
        const ips = DB.get(DB.KEYS.IPS);
        const subnet = IPUtils.findSubnetForIP(ipAddress);
        const subnetId = subnet ? subnet.id : null;
        const existingIndex = ips.findIndex(ip => ip.ipAddress === ipAddress);
        if (existingIndex !== -1) {
            ips[existingIndex].hostId = hostId;
            ips[existingIndex].status = status;
            if (subnetId) ips[existingIndex].subnetId = subnetId;
            ips[existingIndex].updatedAt = new Date().toISOString();
        } else {
            ips.push({
                id: DB.generateId(),
                ipAddress,
                subnetId,
                hostId,
                status,
                createdAt: new Date().toISOString()
            });
        }
        DB.set(DB.KEYS.IPS, ips);
        return { success: true, subnetId };
    },
    getByHostId(hostId) {
        const ips = DB.get(DB.KEYS.IPS);
        return ips.filter(ip => ip.hostId === hostId);
    },
    getBySubnetId(subnetId) {
        const ips = DB.get(DB.KEYS.IPS);
        return ips.filter(ip => ip.subnetId === subnetId);
    },
    updateStatus(ipAddress, status, hostId = null) {
        const ips = DB.get(DB.KEYS.IPS);
        const index = ips.findIndex(ip => ip.ipAddress === ipAddress);
        if (index !== -1) {
            ips[index].status = status;
            if (hostId !== null) ips[index].hostId = hostId;
            ips[index].updatedAt = new Date().toISOString();
            DB.set(DB.KEYS.IPS, ips);
            return { success: true };
        }
        const subnet = IPUtils.findSubnetForIP(ipAddress);
        ips.push({
            id: DB.generateId(),
            ipAddress,
            subnetId: subnet ? subnet.id : null,
            hostId,
            status,
            createdAt: new Date().toISOString()
        });
        DB.set(DB.KEYS.IPS, ips);
        return { success: true };
    }
};
