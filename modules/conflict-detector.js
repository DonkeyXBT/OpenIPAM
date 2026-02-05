const ConflictDetector = {
    checkForConflicts() {
        const ips = DB.get(DB.KEYS.IPS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const conflicts = [];
        const ipGroups = {};
        ips.forEach(ip => {
            if (!ipGroups[ip.ipAddress]) {
                ipGroups[ip.ipAddress] = [];
            }
            ipGroups[ip.ipAddress].push(ip);
        });
        Object.entries(ipGroups).forEach(([ipAddress, records]) => {
            const assignedRecords = records.filter(r => r.status === 'assigned' && r.hostId);
            if (assignedRecords.length > 1) {
                const hostNames = assignedRecords.map(r => {
                    const host = hosts.find(h => h.id === r.hostId);
                    return host ? host.vmName : 'Unknown';
                });
                conflicts.push({
                    type: 'duplicate',
                    ipAddress,
                    message: `IP ${ipAddress} is assigned to multiple hosts`,
                    hosts: hostNames,
                    severity: 'high'
                });
            }
        });
        const subnets = DB.get(DB.KEYS.SUBNETS);
        ips.forEach(ip => {
            if (ip.subnetId) {
                const subnet = subnets.find(s => s.id === ip.subnetId);
                if (subnet && !IPUtils.isIPInSubnet(ip.ipAddress, subnet.network, subnet.cidr)) {
                    conflicts.push({
                        type: 'subnet_mismatch',
                        ipAddress: ip.ipAddress,
                        message: `IP ${ip.ipAddress} is assigned to subnet ${subnet.network}/${subnet.cidr} but is not within range`,
                        severity: 'medium'
                    });
                }
            }
        });
        subnets.forEach(subnet => {
            const networkIP = subnet.network;
            const broadcastIP = IPUtils.getBroadcastAddress(subnet.network, subnet.cidr);
            ips.forEach(ip => {
                if (ip.status === 'assigned' && ip.hostId) {
                    if (ip.ipAddress === networkIP) {
                        conflicts.push({
                            type: 'network_address',
                            ipAddress: ip.ipAddress,
                            message: `Network address ${ip.ipAddress} should not be assigned to a host`,
                            severity: 'high'
                        });
                    }
                    if (ip.ipAddress === broadcastIP) {
                        conflicts.push({
                            type: 'broadcast_address',
                            ipAddress: ip.ipAddress,
                            message: `Broadcast address ${ip.ipAddress} should not be assigned to a host`,
                            severity: 'high'
                        });
                    }
                }
            });
        });
        return conflicts;
    },
    checkIPConflict(ipAddress, excludeHostId = null) {
        const ips = DB.get(DB.KEYS.IPS);
        const existing = ips.find(ip =>
            ip.ipAddress === ipAddress &&
            ip.status === 'assigned' &&
            ip.hostId &&
            ip.hostId !== excludeHostId
        );
        if (existing) {
            const hosts = DB.get(DB.KEYS.HOSTS);
            const host = hosts.find(h => h.id === existing.hostId);
            return {
                hasConflict: true,
                message: `IP already assigned to ${host ? host.vmName : 'unknown host'}`,
                hostId: existing.hostId,
                hostName: host ? host.vmName : 'Unknown'
            };
        }
        return { hasConflict: false };
    }
};
