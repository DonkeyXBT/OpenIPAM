const SubnetManager = {
    getAll() {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const ips = DB.get(DB.KEYS.IPS);
        const companies = DB.get(DB.KEYS.COMPANIES);
        return subnets.map(subnet => {
            const subnetIPs = ips.filter(ip => ip.subnetId === subnet.id);
            const assignedCount = subnetIPs.filter(ip => ip.status === 'assigned').length;
            const reservedCount = subnetIPs.filter(ip => ip.status === 'reserved').length;
            const totalHosts = IPUtils.getTotalHosts(subnet.cidr);
            const company = companies.find(c => c.id === subnet.companyId);
            return {
                ...subnet,
                totalHosts,
                assignedCount,
                reservedCount,
                availableCount: totalHosts - assignedCount - reservedCount,
                companyName: company ? company.name : 'Unassigned',
                companyColor: company ? company.color : '#6b7280'
            };
        });
    },
    getByCompany(companyId) {
        return this.getAll().filter(s => s.companyId === companyId);
    },
    getById(id) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        return subnets.find(s => s.id === id);
    },
    add(data) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        if (!IPUtils.isValidIP(data.network)) {
            return { success: false, message: 'Invalid network address' };
        }
        const networkAddress = IPUtils.getNetworkAddress(data.network, data.cidr);
        const exists = subnets.some(s =>
            s.network === networkAddress && s.cidr === data.cidr
        );
        if (exists) {
            return { success: false, message: 'Subnet already exists' };
        }
        const newSubnet = {
            id: DB.generateId(),
            companyId: data.companyId || null,
            network: networkAddress,
            cidr: parseInt(data.cidr),
            name: data.name || '',
            description: data.description || '',
            vlanId: data.vlanId || null,
            gateway: data.gateway || '',
            dnsServers: data.dnsServers || '',
            createdAt: new Date().toISOString()
        };
        subnets.push(newSubnet);
        DB.set(DB.KEYS.SUBNETS, subnets);
        // Auto-link existing IPs that fall within this new subnet's range
        const ips = DB.get(DB.KEYS.IPS);
        let linkedCount = 0;
        ips.forEach(ip => {
            if (!ip.subnetId && IPUtils.isIPInSubnet(ip.ipAddress, networkAddress, newSubnet.cidr)) {
                ip.subnetId = newSubnet.id;
                linkedCount++;
            }
        });
        if (linkedCount > 0) {
            DB.set(DB.KEYS.IPS, ips);
        }
        const msg = linkedCount > 0
            ? `Subnet added successfully (${linkedCount} existing IP${linkedCount > 1 ? 's' : ''} linked)`
            : 'Subnet added successfully';
        return { success: true, message: msg, subnet: newSubnet };
    },
    update(id, updates) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const index = subnets.findIndex(s => s.id === id);
        if (index === -1) {
            return { success: false, message: 'Subnet not found' };
        }
        subnets[index] = { ...subnets[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.SUBNETS, subnets);
        // Re-link orphaned IPs that now fall within the updated subnet
        const updatedSubnet = subnets[index];
        const network = updates.network
            ? IPUtils.getNetworkAddress(updates.network, updatedSubnet.cidr)
            : updatedSubnet.network;
        const cidr = updatedSubnet.cidr;
        const ips = DB.get(DB.KEYS.IPS);
        let changed = false;
        ips.forEach(ip => {
            if (!ip.subnetId && IPUtils.isIPInSubnet(ip.ipAddress, network, cidr)) {
                ip.subnetId = id;
                changed = true;
            }
        });
        if (changed) {
            DB.set(DB.KEYS.IPS, ips);
        }
        return { success: true, message: 'Subnet updated successfully' };
    },
    delete(id) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const ips = DB.get(DB.KEYS.IPS);
        const assignedIPs = ips.filter(ip => ip.subnetId === id && ip.status === 'assigned');
        if (assignedIPs.length > 0) {
            return { success: false, message: 'Cannot delete subnet with assigned IP addresses' };
        }
        const newSubnets = subnets.filter(s => s.id !== id);
        const newIPs = ips.filter(ip => ip.subnetId !== id);
        DB.set(DB.KEYS.SUBNETS, newSubnets);
        DB.set(DB.KEYS.IPS, newIPs);
        return { success: true, message: 'Subnet deleted successfully' };
    }
};
