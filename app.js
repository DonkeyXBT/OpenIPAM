/**
 * NetManager - IPAM & CMDB Solution
 * Professional JavaScript Application
 */

// ============================================
// Database Layer
// ============================================

const DB = {
    KEYS: {
        COMPANIES: 'ipdb_companies',
        SUBNETS: 'ipdb_subnets',
        HOSTS: 'ipdb_hosts',
        IPS: 'ipdb_ips'
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
            if (item) total += item.length * 2; // UTF-16 characters
        });
        return total;
    }
};

// ============================================
// IP Utility Functions
// ============================================

const IPUtils = {
    ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    },

    intToIp(int) {
        return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    },

    isValidIP(ip) {
        const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!pattern.test(ip)) return false;
        return ip.split('.').every(octet => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255;
        });
    },

    getNetworkAddress(ip, cidr) {
        const ipInt = this.ipToInt(ip);
        const mask = (-1 << (32 - cidr)) >>> 0;
        return this.intToIp((ipInt & mask) >>> 0);
    },

    getBroadcastAddress(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        const hostBits = 32 - cidr;
        const broadcastInt = (networkInt | ((1 << hostBits) - 1)) >>> 0;
        return this.intToIp(broadcastInt);
    },

    getTotalHosts(cidr) {
        if (cidr >= 31) return cidr === 31 ? 2 : 1;
        return Math.pow(2, 32 - cidr) - 2;
    },

    isIPInSubnet(ip, networkIp, cidr) {
        const ipInt = this.ipToInt(ip);
        const networkInt = this.ipToInt(networkIp);
        const mask = (-1 << (32 - cidr)) >>> 0;
        return (ipInt & mask) === (networkInt & mask);
    },

    sortIPs(ips) {
        return ips.sort((a, b) => this.ipToInt(a) - this.ipToInt(b));
    },

    findSubnetForIP(ip) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        for (const subnet of subnets) {
            if (this.isIPInSubnet(ip, subnet.network, subnet.cidr)) {
                return subnet;
            }
        }
        return null;
    }
};

// ============================================
// Company Management
// ============================================

const CompanyManager = {
    getAll() {
        const companies = DB.get(DB.KEYS.COMPANIES);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const ips = DB.get(DB.KEYS.IPS);

        return companies.map(company => {
            const companySubnets = subnets.filter(s => s.companyId === company.id);
            const companyHosts = hosts.filter(h => h.companyId === company.id);
            const companyIPs = ips.filter(ip => {
                const subnet = subnets.find(s => s.id === ip.subnetId);
                return subnet && subnet.companyId === company.id;
            });

            return {
                ...company,
                subnetCount: companySubnets.length,
                hostCount: companyHosts.length,
                ipCount: companyIPs.filter(ip => ip.status === 'assigned').length
            };
        });
    },

    getById(id) {
        const companies = DB.get(DB.KEYS.COMPANIES);
        return companies.find(c => c.id === id);
    },

    add(data) {
        const companies = DB.get(DB.KEYS.COMPANIES);

        const exists = companies.some(c =>
            c.name.toLowerCase() === data.name.toLowerCase()
        );
        if (exists) {
            return { success: false, message: 'Company already exists' };
        }

        const newCompany = {
            id: DB.generateId(),
            name: data.name,
            code: data.code || data.name.substring(0, 4).toUpperCase(),
            contact: data.contact || '',
            email: data.email || '',
            color: data.color || '#3b82f6',
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };

        companies.push(newCompany);
        DB.set(DB.KEYS.COMPANIES, companies);

        return { success: true, message: 'Company added successfully', company: newCompany };
    },

    update(id, updates) {
        const companies = DB.get(DB.KEYS.COMPANIES);
        const index = companies.findIndex(c => c.id === id);

        if (index === -1) {
            return { success: false, message: 'Company not found' };
        }

        companies[index] = { ...companies[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.COMPANIES, companies);

        return { success: true, message: 'Company updated successfully' };
    },

    delete(id) {
        const companies = DB.get(DB.KEYS.COMPANIES);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const hosts = DB.get(DB.KEYS.HOSTS);

        // Check for associated resources
        const hasSubnets = subnets.some(s => s.companyId === id);
        const hasHosts = hosts.some(h => h.companyId === id);

        if (hasSubnets || hasHosts) {
            return { success: false, message: 'Cannot delete company with associated subnets or hosts' };
        }

        const newCompanies = companies.filter(c => c.id !== id);
        DB.set(DB.KEYS.COMPANIES, newCompanies);

        return { success: true, message: 'Company deleted successfully' };
    }
};

// ============================================
// Subnet Management
// ============================================

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

        return { success: true, message: 'Subnet added successfully', subnet: newSubnet };
    },

    update(id, updates) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const index = subnets.findIndex(s => s.id === id);

        if (index === -1) {
            return { success: false, message: 'Subnet not found' };
        }

        subnets[index] = { ...subnets[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.SUBNETS, subnets);

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

// ============================================
// IP Address Management (IPAM)
// ============================================

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

            return {
                ...ip,
                hostName: host ? host.vmName : null,
                hostOS: host ? host.operatingSystem : null,
                hostState: host ? host.state : null,
                subnetName: subnet ? `${subnet.network}/${subnet.cidr}` : null,
                companyId: subnet?.companyId || null,
                companyName: company ? company.name : null,
                companyColor: company ? company.color : '#6b7280'
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

        if (!subnetId) {
            const subnet = IPUtils.findSubnetForIP(ipAddress);
            if (subnet) subnetId = subnet.id;
        }

        const existingIndex = ips.findIndex(ip => ip.ipAddress === ipAddress);

        if (existingIndex !== -1) {
            if (ips[existingIndex].status === 'assigned' && ips[existingIndex].hostId !== hostId) {
                return { success: false, message: 'IP already assigned to another host' };
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
        return { success: true, message: 'IP assigned successfully' };
    },

    release(ipAddress) {
        const ips = DB.get(DB.KEYS.IPS);
        const index = ips.findIndex(ip => ip.ipAddress === ipAddress);

        if (index === -1) {
            return { success: false, message: 'IP not found' };
        }

        ips[index].hostId = null;
        ips[index].status = 'available';
        ips[index].updatedAt = new Date().toISOString();

        DB.set(DB.KEYS.IPS, ips);
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

// ============================================
// Host Management (CMDB)
// ============================================

const HostManager = {
    getAll() {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const ips = DB.get(DB.KEYS.IPS);
        const companies = DB.get(DB.KEYS.COMPANIES);

        return hosts.map(host => {
            const hostIPs = ips.filter(ip => ip.hostId === host.id);
            const company = companies.find(c => c.id === host.companyId);
            return {
                ...host,
                ipAddresses: hostIPs.map(ip => ip.ipAddress).join(', '),
                companyName: company ? company.name : 'Unassigned',
                companyColor: company ? company.color : '#6b7280'
            };
        });
    },

    getById(id) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const host = hosts.find(h => h.id === id);
        if (!host) return null;

        const ips = DB.get(DB.KEYS.IPS);
        const hostIPs = ips.filter(ip => ip.hostId === id);
        const companies = DB.get(DB.KEYS.COMPANIES);
        const company = companies.find(c => c.id === host.companyId);

        return {
            ...host,
            ipAddresses: hostIPs.map(ip => ip.ipAddress).join(', '),
            companyName: company ? company.name : 'Unassigned',
            companyColor: company ? company.color : '#6b7280'
        };
    },

    getByVMName(vmName) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        return hosts.find(h => h.vmName.toLowerCase() === vmName.toLowerCase());
    },

    add(data, ipAssignment = {}) {
        const hosts = DB.get(DB.KEYS.HOSTS);

        const newHost = {
            id: DB.generateId(),
            companyId: data.companyId || null,
            vmName: data.vmName,
            operatingSystem: data.operatingSystem || '',
            memoryUsedGB: parseFloat(data.memoryUsedGB) || null,
            memoryAvailableGB: parseFloat(data.memoryAvailableGB) || null,
            memoryTotalGB: parseFloat(data.memoryTotalGB) || null,
            node: data.node || '',
            diskSizeGB: parseFloat(data.diskSizeGB) || null,
            diskUsedGB: parseFloat(data.diskUsedGB) || null,
            state: data.state || 'running',
            cpuCount: parseInt(data.cpuCount) || null,
            favorite: data.favorite ? 1 : 0,
            createdAt: new Date().toISOString()
        };

        hosts.push(newHost);
        DB.set(DB.KEYS.HOSTS, hosts);

        const assignedIPs = [];

        if (ipAssignment.method === 'auto' && ipAssignment.subnetId) {
            const nextIP = IPManager.getNextAvailable(ipAssignment.subnetId);
            if (nextIP) {
                IPManager.assign(nextIP, newHost.id, ipAssignment.subnetId);
                assignedIPs.push(nextIP);
            }
        } else if (ipAssignment.method === 'manual' && ipAssignment.ips) {
            const ipList = ipAssignment.ips.split(',').map(ip => ip.trim()).filter(ip => ip);
            ipList.forEach(ip => {
                const result = IPManager.register(ip, newHost.id, 'assigned');
                if (result.success) assignedIPs.push(ip);
            });
        }

        return {
            success: true,
            message: `Host added${assignedIPs.length ? ' with IPs: ' + assignedIPs.join(', ') : ''}`,
            host: newHost,
            assignedIPs
        };
    },

    update(id, updates) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const index = hosts.findIndex(h => h.id === id);

        if (index === -1) {
            return { success: false, message: 'Host not found' };
        }

        if (updates.memoryUsedGB !== undefined) updates.memoryUsedGB = parseFloat(updates.memoryUsedGB) || null;
        if (updates.memoryAvailableGB !== undefined) updates.memoryAvailableGB = parseFloat(updates.memoryAvailableGB) || null;
        if (updates.memoryTotalGB !== undefined) updates.memoryTotalGB = parseFloat(updates.memoryTotalGB) || null;
        if (updates.diskSizeGB !== undefined) updates.diskSizeGB = parseFloat(updates.diskSizeGB) || null;
        if (updates.diskUsedGB !== undefined) updates.diskUsedGB = parseFloat(updates.diskUsedGB) || null;
        if (updates.cpuCount !== undefined) updates.cpuCount = parseInt(updates.cpuCount) || null;

        hosts[index] = { ...hosts[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.HOSTS, hosts);

        return { success: true, message: 'Host updated successfully' };
    },

    delete(id) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const ips = DB.get(DB.KEYS.IPS);

        const updatedIPs = ips.map(ip => {
            if (ip.hostId === id) {
                return { ...ip, hostId: null, status: 'available', updatedAt: new Date().toISOString() };
            }
            return ip;
        });

        const newHosts = hosts.filter(h => h.id !== id);

        DB.set(DB.KEYS.HOSTS, newHosts);
        DB.set(DB.KEYS.IPS, updatedIPs);

        return { success: true, message: 'Host deleted successfully' };
    }
};

// ============================================
// CSV Import/Export
// ============================================

const CSVManager = {
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        const parseRow = (row) => {
            const values = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());
            return values;
        };

        const headers = parseRow(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseRow(lines[i]);
            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx] || '';
            });
            data.push(row);
        }

        return data;
    },

    import(content, companyId = null, updateExisting = true) {
        const data = this.parseCSV(content);
        const stats = { added: 0, updated: 0, skipped: 0, errors: 0 };
        const errors = [];

        data.forEach((row, index) => {
            try {
                const vmName = row['VM Name']?.trim();
                if (!vmName) {
                    stats.skipped++;
                    return;
                }

                const ipField = row['IP Addresses'] || '';
                const ipAddresses = ipField.split(',').map(ip => ip.trim()).filter(ip => ip);

                const existingHost = HostManager.getByVMName(vmName);

                if (existingHost) {
                    if (updateExisting) {
                        HostManager.update(existingHost.id, {
                            companyId: companyId || existingHost.companyId,
                            operatingSystem: row['Operating System'] || existingHost.operatingSystem,
                            memoryUsedGB: row['Memory Used (GB)'] || existingHost.memoryUsedGB,
                            memoryAvailableGB: row['Memory Available (GB)'] || existingHost.memoryAvailableGB,
                            memoryTotalGB: row['Memory Total (GB)'] || existingHost.memoryTotalGB,
                            node: row['Node'] || existingHost.node,
                            diskSizeGB: row['Disk Size (GB)'] || existingHost.diskSizeGB,
                            diskUsedGB: row['Disk Used (GB)'] || existingHost.diskUsedGB,
                            state: row['State'] || existingHost.state,
                            cpuCount: row['CPU Count'] || existingHost.cpuCount,
                            favorite: row['Fav'] === '1' || row['Fav']?.toLowerCase() === 'true' ? 1 : 0
                        });

                        ipAddresses.forEach(ip => {
                            if (IPUtils.isValidIP(ip)) {
                                IPManager.register(ip, existingHost.id, 'assigned');
                            }
                        });

                        stats.updated++;
                    } else {
                        stats.skipped++;
                    }
                } else {
                    const hosts = DB.get(DB.KEYS.HOSTS);
                    const newHost = {
                        id: DB.generateId(),
                        companyId: companyId || null,
                        vmName: vmName,
                        operatingSystem: row['Operating System'] || '',
                        memoryUsedGB: parseFloat(row['Memory Used (GB)']) || null,
                        memoryAvailableGB: parseFloat(row['Memory Available (GB)']) || null,
                        memoryTotalGB: parseFloat(row['Memory Total (GB)']) || null,
                        node: row['Node'] || '',
                        diskSizeGB: parseFloat(row['Disk Size (GB)']) || null,
                        diskUsedGB: parseFloat(row['Disk Used (GB)']) || null,
                        state: row['State'] || 'running',
                        cpuCount: parseInt(row['CPU Count']) || null,
                        favorite: row['Fav'] === '1' || row['Fav']?.toLowerCase() === 'true' ? 1 : 0,
                        createdAt: new Date().toISOString()
                    };

                    hosts.push(newHost);
                    DB.set(DB.KEYS.HOSTS, hosts);

                    // Register IPs - automatically links to matching subnets
                    ipAddresses.forEach(ip => {
                        if (IPUtils.isValidIP(ip)) {
                            IPManager.register(ip, newHost.id, 'assigned');
                        }
                    });

                    stats.added++;
                }
            } catch (e) {
                stats.errors++;
                errors.push(`Row ${index + 2}: ${e.message}`);
            }
        });

        return { stats, errors };
    },

    export() {
        const hosts = HostManager.getAll();
        const headers = [
            'Operating System', 'Memory Used (GB)', 'Memory Available (GB)',
            'VM Name', 'Node', 'Disk Size (GB)', 'State', 'CPU Count',
            'Disk Used (GB)', 'Memory Total (GB)', 'IP Addresses', 'Fav'
        ];

        let csv = headers.map(h => `"${h}"`).join(',') + '\n';

        hosts.forEach(host => {
            const row = [
                host.operatingSystem || '',
                host.memoryUsedGB || '',
                host.memoryAvailableGB || '',
                host.vmName || '',
                host.node || '',
                host.diskSizeGB || '',
                host.state || '',
                host.cpuCount || '',
                host.diskUsedGB || '',
                host.memoryTotalGB || '',
                host.ipAddresses || '',
                host.favorite ? '1' : '0'
            ];
            csv += row.map(v => `"${v}"`).join(',') + '\n';
        });

        return csv;
    }
};

// ============================================
// UI State & Navigation
// ============================================

let currentSort = { field: 'vm_name', direction: 'asc' };
let selectedHosts = new Set();
let selectedIPs = new Set();

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === page);
    });

    switch (page) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'companies':
            refreshCompaniesGrid();
            break;
        case 'subnets':
            refreshSubnetsTable();
            populateCompanyFilters();
            break;
        case 'hosts':
            refreshHostsTable();
            populateAllFilters();
            break;
        case 'ipam':
            refreshIPsTable();
            populateAllFilters();
            break;
        case 'import':
            populateImportCompanySelect();
            break;
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ============================================
// Dashboard
// ============================================

function refreshDashboard() {
    const companies = CompanyManager.getAll();
    const subnets = SubnetManager.getAll();
    const hosts = HostManager.getAll();

    // Update stats
    document.getElementById('totalCompanies').textContent = companies.length;
    document.getElementById('totalSubnets').textContent = subnets.length;
    document.getElementById('totalHosts').textContent = hosts.length;
    document.getElementById('runningHosts').textContent = hosts.filter(h => h.state?.toLowerCase() === 'running').length;

    // Filter by company if selected
    const filterCompany = document.getElementById('utilizationFilter')?.value;
    let filteredSubnets = filterCompany
        ? subnets.filter(s => s.companyId === filterCompany)
        : subnets;

    // IP Utilization
    let totalCapacity = 0;
    let totalAssigned = 0;
    let totalReserved = 0;

    filteredSubnets.forEach(subnet => {
        totalCapacity += subnet.totalHosts;
        totalAssigned += subnet.assignedCount;
        totalReserved += subnet.reservedCount;
    });

    const usagePercent = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;

    document.getElementById('overallUsagePercent').textContent = `${usagePercent}%`;
    document.getElementById('assignedIPs').textContent = totalAssigned;
    document.getElementById('availableIPs').textContent = totalCapacity - totalAssigned - totalReserved;
    document.getElementById('reservedIPs').textContent = totalReserved;

    // Update donut chart
    const donutSegment = document.querySelector('.donut-segment');
    if (donutSegment) {
        donutSegment.setAttribute('stroke-dasharray', `${usagePercent}, 100`);
    }

    // Populate utilization filter
    const utilizationFilter = document.getElementById('utilizationFilter');
    if (utilizationFilter) {
        const currentValue = utilizationFilter.value;
        utilizationFilter.innerHTML = '<option value="">All Companies</option>' +
            companies.map(c => `<option value="${c.id}"${c.id === currentValue ? ' selected' : ''}>${c.name}</option>`).join('');
    }

    // Companies Overview
    const companiesOverview = document.getElementById('companiesOverview');
    if (companies.length === 0) {
        companiesOverview.innerHTML = `
            <p class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 21h18M9 8h1m-1 4h1m4-4h1m-1 4h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/>
                </svg>
                <span>No companies configured</span>
                <button class="btn-link" onclick="showAddCompanyModal()">Add your first company</button>
            </p>
        `;
    } else {
        companiesOverview.innerHTML = companies.slice(0, 5).map(company => `
            <div class="company-item">
                <div class="company-color" style="background: ${company.color}"></div>
                <div class="company-info">
                    <h4>${escapeHtml(company.name)}</h4>
                    <span>${company.code || ''}</span>
                </div>
                <div class="company-stats">
                    <span><strong>${company.subnetCount}</strong> subnets</span>
                    <span><strong>${company.hostCount}</strong> hosts</span>
                </div>
            </div>
        `).join('');
    }

    // Recent Hosts
    const recentHosts = hosts.slice(-10).reverse();
    const recentTable = document.getElementById('recentHostsTable').querySelector('tbody');

    if (recentHosts.length === 0) {
        recentTable.innerHTML = '<tr><td colspan="6" class="empty-message">No hosts found</td></tr>';
    } else {
        recentTable.innerHTML = recentHosts.map(host => `
            <tr>
                <td><strong>${escapeHtml(host.vmName)}</strong>${host.favorite ? ' ⭐' : ''}</td>
                <td>
                    <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                        <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                        ${escapeHtml(host.companyName)}
                    </span>
                </td>
                <td>${escapeHtml(host.operatingSystem || '-')}</td>
                <td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>
                <td>${escapeHtml(host.ipAddresses || '-')}</td>
                <td>${escapeHtml(host.node || '-')}</td>
            </tr>
        `).join('');
    }

    // Update storage info
    updateStorageInfo();
}

function updateStorageInfo() {
    const size = DB.getStorageSize();
    const sizeKB = (size / 1024).toFixed(1);
    document.getElementById('storageUsed').textContent = `${sizeKB} KB`;

    // Assume 5MB limit for localStorage
    const percentage = Math.min((size / (5 * 1024 * 1024)) * 100, 100);
    document.getElementById('storageFill').style.width = `${percentage}%`;
}

// ============================================
// Companies UI
// ============================================

function refreshCompaniesGrid() {
    const companies = CompanyManager.getAll();
    const grid = document.getElementById('companiesGrid');

    let html = `
        <div class="company-card add-new" onclick="showAddCompanyModal()">
            <div class="add-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </div>
            <span>Add New Company</span>
        </div>
    `;

    companies.forEach(company => {
        html += `
            <div class="company-card" style="--company-color: ${company.color}" onclick="viewCompanyDetails('${company.id}')">
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: ${company.color}"></div>
                <div class="company-card-actions">
                    <button class="btn-icon edit" onclick="event.stopPropagation(); editCompany('${company.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); deleteCompany('${company.id}')" title="Delete">🗑️</button>
                </div>
                <div class="company-card-header">
                    <div class="company-card-icon" style="background: ${company.color}">
                        ${company.code ? company.code.substring(0, 2) : company.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div class="company-card-title">
                        <h3>${escapeHtml(company.name)}</h3>
                        <span>${company.contact || 'No contact'}</span>
                    </div>
                </div>
                <div class="company-card-stats">
                    <div class="company-stat">
                        <span class="company-stat-value">${company.subnetCount}</span>
                        <span class="company-stat-label">Subnets</span>
                    </div>
                    <div class="company-stat">
                        <span class="company-stat-value">${company.hostCount}</span>
                        <span class="company-stat-label">Hosts</span>
                    </div>
                    <div class="company-stat">
                        <span class="company-stat-value">${company.ipCount}</span>
                        <span class="company-stat-label">IPs</span>
                    </div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function showAddCompanyModal() {
    document.getElementById('companyForm').reset();
    document.getElementById('companyEditId').value = '';
    document.getElementById('companyColor').value = '#3b82f6';
    document.querySelector('#addCompanyModal .modal-header h3').textContent = 'Add Company';
    openModal('addCompanyModal');
}

function editCompany(id) {
    const company = CompanyManager.getById(id);
    if (!company) return;

    document.getElementById('companyName').value = company.name || '';
    document.getElementById('companyCode').value = company.code || '';
    document.getElementById('companyContact').value = company.contact || '';
    document.getElementById('companyEmail').value = company.email || '';
    document.getElementById('companyColor').value = company.color || '#3b82f6';
    document.getElementById('companyNotes').value = company.notes || '';
    document.getElementById('companyEditId').value = id;

    document.querySelector('#addCompanyModal .modal-header h3').textContent = 'Edit Company';
    openModal('addCompanyModal');
}

function saveCompany(e) {
    e.preventDefault();

    const id = document.getElementById('companyEditId').value;
    const data = {
        name: document.getElementById('companyName').value,
        code: document.getElementById('companyCode').value,
        contact: document.getElementById('companyContact').value,
        email: document.getElementById('companyEmail').value,
        color: document.getElementById('companyColor').value,
        notes: document.getElementById('companyNotes').value
    };

    let result;
    if (id) {
        result = CompanyManager.update(id, data);
    } else {
        result = CompanyManager.add(data);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshCompaniesGrid();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

function deleteCompany(id) {
    const company = CompanyManager.getById(id);
    if (!company) return;

    if (!confirm(`Delete company "${company.name}"?`)) return;

    const result = CompanyManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshCompaniesGrid();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

function viewCompanyDetails(id) {
    navigateTo('subnets');
    document.getElementById('subnetCompanyFilter').value = id;
    filterSubnets();
}

// ============================================
// Subnets UI
// ============================================

function refreshSubnetsTable() {
    const subnets = SubnetManager.getAll();
    const tbody = document.getElementById('subnetsTable').querySelector('tbody');

    if (subnets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No subnets configured</td></tr>';
        return;
    }

    tbody.innerHTML = subnets.map(subnet => {
        const usage = subnet.totalHosts > 0 ? Math.round((subnet.assignedCount / subnet.totalHosts) * 100) : 0;
        const barClass = usage >= 90 ? 'high' : usage >= 70 ? 'medium' : 'low';

        return `
            <tr data-company="${subnet.companyId || ''}">
                <td><strong style="font-family: monospace;">${subnet.network}/${subnet.cidr}</strong></td>
                <td>
                    <span class="company-badge" style="background: ${subnet.companyColor}15; color: ${subnet.companyColor}">
                        <span class="company-badge-dot" style="background: ${subnet.companyColor}"></span>
                        ${escapeHtml(subnet.companyName)}
                    </span>
                </td>
                <td>${escapeHtml(subnet.name || '-')}</td>
                <td>${subnet.vlanId || '-'}</td>
                <td>${escapeHtml(subnet.gateway || '-')}</td>
                <td>${subnet.assignedCount} / ${subnet.totalHosts}</td>
                <td>
                    <div class="usage-bar-container">
                        <div class="usage-bar">
                            <div class="usage-bar-fill ${barClass}" style="width: ${usage}%"></div>
                        </div>
                        <span class="usage-text">${usage}%</span>
                    </div>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon view" onclick="viewSubnetIPs('${subnet.id}')" title="View IPs">👁</button>
                        <button class="btn-icon edit" onclick="editSubnet('${subnet.id}')" title="Edit">✏️</button>
                        <button class="btn-icon delete" onclick="deleteSubnet('${subnet.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterSubnets() {
    const search = document.getElementById('subnetSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('subnetCompanyFilter').value;

    const rows = document.querySelectorAll('#subnetsTable tbody tr[data-company]');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;

        let visible = true;
        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;

        row.style.display = visible ? '' : 'none';
    });
}

function showAddSubnetModal() {
    document.getElementById('subnetForm').reset();
    document.getElementById('subnetEditId').value = '';
    populateCompanySelect('subnetCompany');
    document.querySelector('#addSubnetModal .modal-header h3').textContent = 'Add Subnet';
    openModal('addSubnetModal');
}

function editSubnet(id) {
    const subnet = SubnetManager.getById(id);
    if (!subnet) return;

    populateCompanySelect('subnetCompany');

    document.getElementById('subnetCompany').value = subnet.companyId || '';
    document.getElementById('subnetNetwork').value = subnet.network;
    document.getElementById('subnetCIDR').value = subnet.cidr;
    document.getElementById('subnetName').value = subnet.name || '';
    document.getElementById('subnetDescription').value = subnet.description || '';
    document.getElementById('subnetVLAN').value = subnet.vlanId || '';
    document.getElementById('subnetGateway').value = subnet.gateway || '';
    document.getElementById('subnetDNS').value = subnet.dnsServers || '';
    document.getElementById('subnetEditId').value = id;

    document.querySelector('#addSubnetModal .modal-header h3').textContent = 'Edit Subnet';
    openModal('addSubnetModal');
}

function saveSubnet(e) {
    e.preventDefault();

    const id = document.getElementById('subnetEditId').value;
    const data = {
        companyId: document.getElementById('subnetCompany').value || null,
        network: document.getElementById('subnetNetwork').value,
        cidr: document.getElementById('subnetCIDR').value,
        name: document.getElementById('subnetName').value,
        description: document.getElementById('subnetDescription').value,
        vlanId: document.getElementById('subnetVLAN').value || null,
        gateway: document.getElementById('subnetGateway').value,
        dnsServers: document.getElementById('subnetDNS').value
    };

    let result;
    if (id) {
        result = SubnetManager.update(id, data);
    } else {
        result = SubnetManager.add(data);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshSubnetsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

function deleteSubnet(id) {
    const subnet = SubnetManager.getById(id);
    if (!subnet) return;

    if (!confirm(`Delete subnet ${subnet.network}/${subnet.cidr}?`)) return;

    const result = SubnetManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshSubnetsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

function viewSubnetIPs(subnetId) {
    const subnet = SubnetManager.getById(subnetId);
    if (!subnet) return;

    const ips = IPManager.getBySubnetId(subnetId);
    const hosts = DB.get(DB.KEYS.HOSTS);

    const ipMap = new Map();
    ips.forEach(ip => {
        const host = ip.hostId ? hosts.find(h => h.id === ip.hostId) : null;
        ipMap.set(ip.ipAddress, { status: ip.status, hostName: host?.vmName });
    });

    const content = document.getElementById('subnetIPsContent');
    const subnetInfo = SubnetManager.getAll().find(s => s.id === subnetId);

    let html = `
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 8px;">${subnet.network}/${subnet.cidr} ${subnet.name ? `(${subnet.name})` : ''}</h4>
            <p style="color: var(--gray-500);">Total: ${subnetInfo.totalHosts} | Assigned: ${subnetInfo.assignedCount} | Available: ${subnetInfo.availableCount}</p>
        </div>
        <div class="ip-list-grid">
    `;

    const networkInt = IPUtils.ipToInt(subnet.network);
    const totalIPs = Math.pow(2, 32 - subnet.cidr);
    const maxDisplay = Math.min(totalIPs - 2, 254);

    for (let i = 1; i <= maxDisplay; i++) {
        const ip = IPUtils.intToIp(networkInt + i);
        const info = ipMap.get(ip);
        const status = info?.status || 'available';
        const hostName = info?.hostName || '';

        html += `
            <div class="ip-item ${status}">
                <div>
                    <div class="ip-address">${ip}</div>
                    <div class="ip-host">${hostName || (status === 'reserved' ? 'Reserved' : 'Available')}</div>
                </div>
                <span class="status-badge ${status}">${status}</span>
            </div>
        `;
    }

    if (totalIPs - 2 > maxDisplay) {
        html += `<div class="ip-item"><em>... and ${totalIPs - 2 - maxDisplay} more IPs</em></div>`;
    }

    html += '</div>';
    content.innerHTML = html;

    document.querySelector('#viewSubnetIPsModal .modal-header h3').textContent = `IPs in ${subnet.network}/${subnet.cidr}`;
    openModal('viewSubnetIPsModal');
}

// ============================================
// Hosts UI
// ============================================

function refreshHostsTable() {
    let hosts = HostManager.getAll();
    hosts = sortData(hosts, currentSort.field, currentSort.direction);

    const tbody = document.getElementById('hostsTable').querySelector('tbody');

    if (hosts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">No hosts found</td></tr>';
        selectedHosts.clear();
        updateBulkEditHostsButton();
        return;
    }

    tbody.innerHTML = hosts.map(host => {
        const resources = [];
        if (host.cpuCount) resources.push(`${host.cpuCount} CPU`);
        if (host.memoryTotalGB) resources.push(`${host.memoryTotalGB}GB RAM`);
        if (host.diskSizeGB) resources.push(`${host.diskSizeGB}GB Disk`);
        const isSelected = selectedHosts.has(host.id);

        return `
            <tr data-id="${host.id}" data-company="${host.companyId || ''}" data-state="${host.state?.toLowerCase()}" data-ips="${host.ipAddresses}" class="${isSelected ? 'selected' : ''}">
                <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleHostSelection('${host.id}', this)"></td>
                <td><strong>${escapeHtml(host.vmName)}</strong>${host.favorite ? ' ⭐' : ''}</td>
                <td>
                    <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                        <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                        ${escapeHtml(host.companyName)}
                    </span>
                </td>
                <td>${escapeHtml(host.operatingSystem || '-')}</td>
                <td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>
                <td>${escapeHtml(host.node || '-')}</td>
                <td class="resource-display"><span>${resources.join(' • ') || '-'}</span></td>
                <td style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(host.ipAddresses || '-')}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon view" onclick="viewHost('${host.id}')" title="View">👁</button>
                        <button class="btn-icon edit" onclick="editHost('${host.id}')" title="Edit">✏️</button>
                        <button class="btn-icon delete" onclick="deleteHost('${host.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateBulkEditHostsButton();
}

function filterHosts() {
    const search = document.getElementById('hostSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('hostCompanyFilter').value;
    const stateFilter = document.getElementById('hostStateFilter').value.toLowerCase();
    const subnetFilter = document.getElementById('hostSubnetFilter').value;

    const rows = document.querySelectorAll('#hostsTable tbody tr[data-id]');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;
        const state = row.dataset.state;
        const ips = row.dataset.ips || '';

        let visible = true;

        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;
        if (stateFilter && state !== stateFilter) visible = false;

        if (subnetFilter) {
            const subnet = SubnetManager.getById(subnetFilter);
            if (subnet) {
                const hostIPs = ips.split(',').map(ip => ip.trim());
                const hasIPInSubnet = hostIPs.some(ip =>
                    IPUtils.isValidIP(ip) && IPUtils.isIPInSubnet(ip, subnet.network, subnet.cidr)
                );
                if (!hasIPInSubnet) visible = false;
            }
        }

        row.style.display = visible ? '' : 'none';
    });
}

function showAddHostModal() {
    document.getElementById('hostForm').reset();
    document.getElementById('hostEditId').value = '';

    populateCompanySelect('hostCompany');

    document.querySelector('input[name="ipMethod"][value="auto"]').checked = true;
    toggleIPAssignment();

    document.querySelector('#addHostModal .modal-header h3').textContent = 'Add Host';
    openModal('addHostModal');
}

function updateHostSubnets() {
    const companyId = document.getElementById('hostCompany').value;
    const subnets = companyId
        ? SubnetManager.getByCompany(companyId)
        : SubnetManager.getAll();

    const select = document.getElementById('hostAutoSubnet');
    select.innerHTML = '<option value="">-- Select Subnet --</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr} - ${s.availableCount} available</option>`).join('');

    updateNextIPPreview();
}

function toggleIPAssignment() {
    const method = document.querySelector('input[name="ipMethod"]:checked').value;
    document.getElementById('autoAssignSection').style.display = method === 'auto' ? 'block' : 'none';
    document.getElementById('manualIPSection').style.display = method === 'manual' ? 'block' : 'none';

    if (method === 'auto') {
        updateHostSubnets();
    }
}

function updateNextIPPreview() {
    const subnetId = document.getElementById('hostAutoSubnet').value;
    const preview = document.getElementById('nextIPPreview');

    if (!subnetId) {
        preview.textContent = '';
        return;
    }

    const nextIP = IPManager.getNextAvailable(subnetId);
    if (nextIP) {
        preview.textContent = `Next available IP: ${nextIP}`;
        preview.classList.add('success');
    } else {
        preview.textContent = 'No available IPs in this subnet';
        preview.classList.remove('success');
    }
}

document.getElementById('hostAutoSubnet')?.addEventListener('change', updateNextIPPreview);

function editHost(id) {
    const host = HostManager.getById(id);
    if (!host) return;

    populateCompanySelect('hostCompany');

    document.getElementById('hostCompany').value = host.companyId || '';
    document.getElementById('hostVMName').value = host.vmName || '';
    document.getElementById('hostOS').value = host.operatingSystem || '';
    document.getElementById('hostState').value = host.state || 'running';
    document.getElementById('hostNode').value = host.node || '';
    document.getElementById('hostCPU').value = host.cpuCount || '';
    document.getElementById('hostMemoryTotal').value = host.memoryTotalGB || '';
    document.getElementById('hostMemoryUsed').value = host.memoryUsedGB || '';
    document.getElementById('hostDiskSize').value = host.diskSizeGB || '';
    document.getElementById('hostDiskUsed').value = host.diskUsedGB || '';
    document.getElementById('hostFavorite').value = host.favorite ? '1' : '0';
    document.getElementById('hostEditId').value = id;

    document.querySelector('input[name="ipMethod"][value="none"]').checked = true;
    toggleIPAssignment();

    document.querySelector('#addHostModal .modal-header h3').textContent = 'Edit Host';
    openModal('addHostModal');
}

function saveHost(e) {
    e.preventDefault();

    const id = document.getElementById('hostEditId').value;
    const data = {
        companyId: document.getElementById('hostCompany').value || null,
        vmName: document.getElementById('hostVMName').value,
        operatingSystem: document.getElementById('hostOS').value,
        state: document.getElementById('hostState').value,
        node: document.getElementById('hostNode').value,
        cpuCount: document.getElementById('hostCPU').value,
        memoryTotalGB: document.getElementById('hostMemoryTotal').value,
        memoryUsedGB: document.getElementById('hostMemoryUsed').value,
        diskSizeGB: document.getElementById('hostDiskSize').value,
        diskUsedGB: document.getElementById('hostDiskUsed').value,
        favorite: document.getElementById('hostFavorite').value === '1'
    };

    if (data.memoryTotalGB && data.memoryUsedGB) {
        data.memoryAvailableGB = parseFloat(data.memoryTotalGB) - parseFloat(data.memoryUsedGB);
    }

    let result;
    if (id) {
        result = HostManager.update(id, data);
    } else {
        const ipMethod = document.querySelector('input[name="ipMethod"]:checked').value;
        const ipAssignment = {
            method: ipMethod,
            subnetId: ipMethod === 'auto' ? document.getElementById('hostAutoSubnet').value : null,
            ips: ipMethod === 'manual' ? document.getElementById('hostManualIPs').value : null
        };
        result = HostManager.add(data, ipAssignment);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshHostsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

function viewHost(id) {
    const host = HostManager.getById(id);
    if (!host) return;

    const details = document.getElementById('hostDetails');
    details.innerHTML = `
        <div class="host-details-grid">
            <div class="detail-item">
                <label>VM Name</label>
                <div class="value">${escapeHtml(host.vmName)} ${host.favorite ? '⭐' : ''}</div>
            </div>
            <div class="detail-item">
                <label>Company</label>
                <div class="value">
                    <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                        <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                        ${escapeHtml(host.companyName)}
                    </span>
                </div>
            </div>
            <div class="detail-item">
                <label>Operating System</label>
                <div class="value">${escapeHtml(host.operatingSystem || '-')}</div>
            </div>
            <div class="detail-item">
                <label>State</label>
                <div class="value"><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></div>
            </div>
            <div class="detail-item">
                <label>Node</label>
                <div class="value">${escapeHtml(host.node || '-')}</div>
            </div>
            <div class="detail-item">
                <label>CPU Count</label>
                <div class="value">${host.cpuCount || '-'}</div>
            </div>
            <div class="detail-item">
                <label>Memory</label>
                <div class="value">${host.memoryUsedGB || 0} / ${host.memoryTotalGB || 0} GB</div>
            </div>
            <div class="detail-item">
                <label>Disk</label>
                <div class="value">${host.diskUsedGB || 0} / ${host.diskSizeGB || 0} GB</div>
            </div>
            <div class="detail-item full-width">
                <label>IP Addresses</label>
                <div class="value" style="font-family: monospace;">${escapeHtml(host.ipAddresses || 'None assigned')}</div>
            </div>
            <div class="detail-item">
                <label>Created</label>
                <div class="value">${host.createdAt ? new Date(host.createdAt).toLocaleString() : '-'}</div>
            </div>
            <div class="detail-item">
                <label>Last Updated</label>
                <div class="value">${host.updatedAt ? new Date(host.updatedAt).toLocaleString() : '-'}</div>
            </div>
        </div>
    `;

    openModal('viewHostModal');
}

function deleteHost(id) {
    const host = HostManager.getById(id);
    if (!host) return;

    if (!confirm(`Delete host "${host.vmName}"? Its IPs will be released.`)) return;

    const result = HostManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshHostsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

// ============================================
// IPAM UI
// ============================================

function refreshIPsTable() {
    let ips = IPManager.getAll();
    ips = ips.sort((a, b) => IPUtils.ipToInt(a.ipAddress) - IPUtils.ipToInt(b.ipAddress));

    const tbody = document.getElementById('ipsTable').querySelector('tbody');

    if (ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No IP addresses tracked</td></tr>';
        selectedIPs.clear();
        updateBulkEditIPsButton();
        return;
    }

    tbody.innerHTML = ips.map(ip => {
        const isSelected = selectedIPs.has(ip.ipAddress);
        return `
        <tr data-ip="${ip.ipAddress}" data-subnet="${ip.subnetId || ''}" data-company="${ip.companyId || ''}" data-status="${ip.status}" class="${isSelected ? 'selected' : ''}">
            <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleIPSelection('${ip.ipAddress}', this)"></td>
            <td><strong style="font-family: monospace;">${ip.ipAddress}</strong></td>
            <td>
                ${ip.companyName ? `
                    <span class="company-badge" style="background: ${ip.companyColor}15; color: ${ip.companyColor}">
                        <span class="company-badge-dot" style="background: ${ip.companyColor}"></span>
                        ${escapeHtml(ip.companyName)}
                    </span>
                ` : '-'}
            </td>
            <td>${escapeHtml(ip.subnetName || '-')}</td>
            <td><span class="status-badge ${ip.status}">${ip.status}</span></td>
            <td>${escapeHtml(ip.hostName || '-')}</td>
            <td>${ip.updatedAt ? new Date(ip.updatedAt).toLocaleDateString() : '-'}</td>
            <td>
                <div class="action-btns">
                    ${ip.status === 'assigned'
                        ? `<button class="btn-icon delete" onclick="releaseIP('${ip.ipAddress}')" title="Release">🔓</button>`
                        : `<button class="btn-icon edit" onclick="editIPAssignment('${ip.ipAddress}')" title="Assign">🔗</button>`
                    }
                </div>
            </td>
        </tr>
    `}).join('');

    updateBulkEditIPsButton();
}

function filterIPs() {
    const search = document.getElementById('ipSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('ipCompanyFilter').value;
    const subnetFilter = document.getElementById('ipSubnetFilter').value;
    const statusFilter = document.getElementById('ipStatusFilter').value;

    const rows = document.querySelectorAll('#ipsTable tbody tr[data-subnet]');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;
        const subnet = row.dataset.subnet;
        const status = row.dataset.status;

        let visible = true;

        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;
        if (subnetFilter && subnet !== subnetFilter) visible = false;
        if (statusFilter && status !== statusFilter) visible = false;

        row.style.display = visible ? '' : 'none';
    });
}

function showAssignIPModal() {
    document.getElementById('assignIPForm').reset();
    populateHostSelect();
    openModal('assignIPModal');
}

function populateHostSelect() {
    const hosts = HostManager.getAll();
    const select = document.getElementById('assignHost');
    select.innerHTML = '<option value="">-- Select Host --</option>' +
        hosts.map(h => `<option value="${h.id}">${h.vmName} (${h.companyName})</option>`).join('');
}

function editIPAssignment(ipAddress) {
    document.getElementById('assignIP').value = ipAddress;
    populateHostSelect();
    openModal('assignIPModal');
}

function saveIPAssignment(e) {
    e.preventDefault();

    const ipAddress = document.getElementById('assignIP').value;
    const hostId = document.getElementById('assignHost').value;
    const status = document.getElementById('assignStatus').value;

    if (!IPUtils.isValidIP(ipAddress)) {
        showToast('Invalid IP address', 'error');
        return;
    }

    let result;
    if (hostId && status === 'assigned') {
        result = IPManager.assign(ipAddress, hostId);
    } else {
        result = IPManager.updateStatus(ipAddress, status, hostId || null);
    }

    if (result.success) {
        showToast('IP assignment saved', 'success');
        closeModal();
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast(result.message || 'Error saving IP assignment', 'error');
    }
}

function releaseIP(ipAddress) {
    if (!confirm(`Release IP ${ipAddress}?`)) return;

    const result = IPManager.release(ipAddress);
    if (result.success) {
        showToast(result.message, 'success');
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

// ============================================
// Import/Export UI
// ============================================

const dropZone = document.getElementById('dropZone');

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processCSVFile(file);
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processCSVFile(file);
}

function processCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        showToast('Please select a CSV file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const companyId = document.getElementById('importCompany').value || null;
        const updateExisting = document.getElementById('updateExisting').checked;

        const result = CSVManager.import(content, companyId, updateExisting);

        const status = document.getElementById('importStatus');
        status.className = 'import-status success';
        status.innerHTML = `
            <strong>Import Complete!</strong><br>
            Added: ${result.stats.added} | Updated: ${result.stats.updated} |
            Skipped: ${result.stats.skipped} | Errors: ${result.stats.errors}
            ${result.errors.length > 0 ? '<br><br>Errors:<br>' + result.errors.slice(0, 5).join('<br>') : ''}
        `;

        showToast(`Imported ${result.stats.added} hosts, updated ${result.stats.updated}`, 'success');
        refreshDashboard();
    };

    reader.readAsText(file);
}

function exportToCSV() {
    const csv = CSVManager.export();
    downloadFile(csv, 'ip_database_export.csv', 'text/csv');
    showToast('CSV exported successfully', 'success');
}

function backupDatabase() {
    const backup = {
        version: 2,
        timestamp: new Date().toISOString(),
        companies: DB.get(DB.KEYS.COMPANIES),
        subnets: DB.get(DB.KEYS.SUBNETS),
        hosts: DB.get(DB.KEYS.HOSTS),
        ips: DB.get(DB.KEYS.IPS)
    };

    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, `netmanager_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    showToast('Backup created successfully', 'success');
}

function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);

            if (!backup.subnets || !backup.hosts || !backup.ips) {
                throw new Error('Invalid backup file');
            }

            if (!confirm('This will replace all current data. Continue?')) return;

            DB.set(DB.KEYS.COMPANIES, backup.companies || []);
            DB.set(DB.KEYS.SUBNETS, backup.subnets);
            DB.set(DB.KEYS.HOSTS, backup.hosts);
            DB.set(DB.KEYS.IPS, backup.ips);

            showToast('Database restored successfully', 'success');
            navigateTo('dashboard');
        } catch (err) {
            showToast('Error restoring backup: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function populateImportCompanySelect() {
    const companies = CompanyManager.getAll();
    const select = document.getElementById('importCompany');
    select.innerHTML = '<option value="">-- No Company --</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// ============================================
// Helper Functions
// ============================================

function populateCompanySelect(selectId) {
    const companies = CompanyManager.getAll();
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Select Company --</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function populateCompanyFilters() {
    const companies = CompanyManager.getAll();
    const options = '<option value="">All Companies</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const filters = ['subnetCompanyFilter', 'hostCompanyFilter', 'ipCompanyFilter'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = options;
    });
}

function populateAllFilters() {
    populateCompanyFilters();

    const subnets = SubnetManager.getAll();
    const subnetOptions = '<option value="">All Subnets</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr}${s.name ? ` (${s.name})` : ''}</option>`).join('');

    const subnetFilters = ['hostSubnetFilter', 'ipSubnetFilter'];
    subnetFilters.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = subnetOptions;
    });
}

// ============================================
// Modal Management
// ============================================

function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function showQuickAddModal() {
    openModal('quickAddModal');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ============================================
// Utility Functions
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sortData(data, field, direction) {
    const fieldMap = {
        'vm_name': 'vmName',
        'operating_system': 'operatingSystem',
        'state': 'state',
        'node': 'node'
    };

    const actualField = fieldMap[field] || field;

    return [...data].sort((a, b) => {
        let aVal = a[actualField] || '';
        let bVal = b[actualField] || '';

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// Table sorting
document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }
        refreshHostsTable();
    });
});

// Clear all data
document.getElementById('clearDataBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
        DB.clearAll();
        showToast('All data cleared', 'info');
        navigateTo('dashboard');
    }
});

// ============================================
// Bulk Edit Functions
// ============================================

// Host Selection
function toggleHostSelection(hostId, checkbox) {
    if (checkbox.checked) {
        selectedHosts.add(hostId);
    } else {
        selectedHosts.delete(hostId);
    }

    const row = checkbox.closest('tr');
    if (row) {
        row.classList.toggle('selected', checkbox.checked);
    }

    updateBulkEditHostsButton();
    updateSelectAllHostsCheckbox();
}

function toggleAllHosts(checkbox) {
    const rows = document.querySelectorAll('#hostsTable tbody tr[data-id]');

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const hostId = row.dataset.id;
            const rowCheckbox = row.querySelector('input[type="checkbox"]');

            if (checkbox.checked) {
                selectedHosts.add(hostId);
                row.classList.add('selected');
                if (rowCheckbox) rowCheckbox.checked = true;
            } else {
                selectedHosts.delete(hostId);
                row.classList.remove('selected');
                if (rowCheckbox) rowCheckbox.checked = false;
            }
        }
    });

    updateBulkEditHostsButton();
}

function updateSelectAllHostsCheckbox() {
    const selectAll = document.getElementById('selectAllHosts');
    const visibleRows = document.querySelectorAll('#hostsTable tbody tr[data-id]:not([style*="display: none"])');

    if (visibleRows.length === 0) {
        if (selectAll) selectAll.checked = false;
        return;
    }

    let allSelected = true;
    visibleRows.forEach(row => {
        if (!selectedHosts.has(row.dataset.id)) {
            allSelected = false;
        }
    });

    if (selectAll) selectAll.checked = allSelected;
}

function updateBulkEditHostsButton() {
    const btn = document.getElementById('bulkEditHostsBtn');
    const count = document.getElementById('bulkEditHostsCount');

    if (btn && count) {
        if (selectedHosts.size > 0) {
            btn.style.display = 'inline-flex';
            count.textContent = `Bulk Edit (${selectedHosts.size})`;
        } else {
            btn.style.display = 'none';
        }
    }
}

function showBulkEditHostsModal() {
    if (selectedHosts.size === 0) {
        showToast('No hosts selected', 'error');
        return;
    }

    document.getElementById('bulkEditHostsForm').reset();
    document.getElementById('bulkEditHostsInfo').textContent = `${selectedHosts.size} host${selectedHosts.size > 1 ? 's' : ''} selected`;

    // Populate company select
    const companies = CompanyManager.getAll();
    const companySelect = document.getElementById('bulkHostCompany');
    companySelect.innerHTML = '<option value="">-- No Change --</option>' +
        companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    openModal('bulkEditHostsModal');
}

function saveBulkEditHosts(e) {
    e.preventDefault();

    const companyId = document.getElementById('bulkHostCompany').value;
    const state = document.getElementById('bulkHostState').value;
    const node = document.getElementById('bulkHostNode').value.trim();
    const os = document.getElementById('bulkHostOS').value.trim();

    // Check if any changes to apply
    if (!companyId && !state && !node && !os) {
        showToast('No changes specified', 'error');
        return;
    }

    let updateCount = 0;

    selectedHosts.forEach(hostId => {
        const updates = {};

        if (companyId) updates.companyId = companyId;
        if (state) updates.state = state;
        if (node) updates.node = node;
        if (os) updates.operatingSystem = os;

        const result = HostManager.update(hostId, updates);
        if (result.success) updateCount++;
    });

    showToast(`Updated ${updateCount} host${updateCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedHosts.clear();
    refreshHostsTable();
    refreshDashboard();
}

function bulkDeleteHosts() {
    if (selectedHosts.size === 0) {
        showToast('No hosts selected', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedHosts.size} host${selectedHosts.size > 1 ? 's' : ''}? Their IPs will be released.`)) {
        return;
    }

    let deleteCount = 0;

    selectedHosts.forEach(hostId => {
        const result = HostManager.delete(hostId);
        if (result.success) deleteCount++;
    });

    showToast(`Deleted ${deleteCount} host${deleteCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedHosts.clear();
    refreshHostsTable();
    refreshDashboard();
}

// IP Selection
function toggleIPSelection(ipAddress, checkbox) {
    if (checkbox.checked) {
        selectedIPs.add(ipAddress);
    } else {
        selectedIPs.delete(ipAddress);
    }

    const row = checkbox.closest('tr');
    if (row) {
        row.classList.toggle('selected', checkbox.checked);
    }

    updateBulkEditIPsButton();
    updateSelectAllIPsCheckbox();
}

function toggleAllIPs(checkbox) {
    const rows = document.querySelectorAll('#ipsTable tbody tr[data-ip]');

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const ipAddress = row.dataset.ip;
            const rowCheckbox = row.querySelector('input[type="checkbox"]');

            if (checkbox.checked) {
                selectedIPs.add(ipAddress);
                row.classList.add('selected');
                if (rowCheckbox) rowCheckbox.checked = true;
            } else {
                selectedIPs.delete(ipAddress);
                row.classList.remove('selected');
                if (rowCheckbox) rowCheckbox.checked = false;
            }
        }
    });

    updateBulkEditIPsButton();
}

function updateSelectAllIPsCheckbox() {
    const selectAll = document.getElementById('selectAllIPs');
    const visibleRows = document.querySelectorAll('#ipsTable tbody tr[data-ip]:not([style*="display: none"])');

    if (visibleRows.length === 0) {
        if (selectAll) selectAll.checked = false;
        return;
    }

    let allSelected = true;
    visibleRows.forEach(row => {
        if (!selectedIPs.has(row.dataset.ip)) {
            allSelected = false;
        }
    });

    if (selectAll) selectAll.checked = allSelected;
}

function updateBulkEditIPsButton() {
    const btn = document.getElementById('bulkEditIPsBtn');
    const count = document.getElementById('bulkEditIPsCount');

    if (btn && count) {
        if (selectedIPs.size > 0) {
            btn.style.display = 'inline-flex';
            count.textContent = `Bulk Edit (${selectedIPs.size})`;
        } else {
            btn.style.display = 'none';
        }
    }
}

function showBulkEditIPsModal() {
    if (selectedIPs.size === 0) {
        showToast('No IPs selected', 'error');
        return;
    }

    document.getElementById('bulkEditIPsForm').reset();
    document.getElementById('bulkEditIPsInfo').textContent = `${selectedIPs.size} IP${selectedIPs.size > 1 ? 's' : ''} selected`;

    // Populate host select
    const hosts = HostManager.getAll();
    const hostSelect = document.getElementById('bulkIPHost');
    hostSelect.innerHTML = '<option value="">-- No Change --</option>' +
        '<option value="__unassign__">Unassign (Release IPs)</option>' +
        hosts.map(h => `<option value="${h.id}">${h.vmName} (${h.companyName})</option>`).join('');

    openModal('bulkEditIPsModal');
}

function saveBulkEditIPs(e) {
    e.preventDefault();

    const status = document.getElementById('bulkIPStatus').value;
    const hostId = document.getElementById('bulkIPHost').value;

    // Check if any changes to apply
    if (!status && !hostId) {
        showToast('No changes specified', 'error');
        return;
    }

    let updateCount = 0;

    selectedIPs.forEach(ipAddress => {
        if (hostId === '__unassign__') {
            // Release the IP
            IPManager.release(ipAddress);
            updateCount++;
        } else if (hostId && status === 'assigned') {
            // Assign to specific host
            const result = IPManager.assign(ipAddress, hostId);
            if (result.success) updateCount++;
        } else if (status) {
            // Just change status
            const result = IPManager.updateStatus(ipAddress, status, hostId || null);
            if (result.success) updateCount++;
        }
    });

    showToast(`Updated ${updateCount} IP${updateCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedIPs.clear();
    refreshIPsTable();
    refreshDashboard();
}

function bulkReleaseIPs() {
    if (selectedIPs.size === 0) {
        showToast('No IPs selected', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to release ${selectedIPs.size} IP${selectedIPs.size > 1 ? 's' : ''}?`)) {
        return;
    }

    let releaseCount = 0;

    selectedIPs.forEach(ipAddress => {
        const result = IPManager.release(ipAddress);
        if (result.success) releaseCount++;
    });

    showToast(`Released ${releaseCount} IP${releaseCount !== 1 ? 's' : ''}`, 'success');
    closeModal();
    selectedIPs.clear();
    refreshIPsTable();
    refreshDashboard();
}

// ============================================
// Initialize Application
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    console.log('NetManager initialized');
});
