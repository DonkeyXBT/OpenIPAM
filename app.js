/**
 * IP Database - IPAM & CMDB Solution
 * Pure JavaScript implementation with localStorage
 */

// ============================================
// Database Layer
// ============================================

const DB = {
    KEYS: {
        SUBNETS: 'ipdb_subnets',
        HOSTS: 'ipdb_hosts',
        IPS: 'ipdb_ips'
    },

    // Get data from localStorage
    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    // Save data to localStorage
    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => localStorage.removeItem(key));
    }
};

// ============================================
// IP Utility Functions
// ============================================

const IPUtils = {
    // Convert IP string to integer for comparison
    ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    },

    // Convert integer back to IP string
    intToIp(int) {
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    },

    // Validate IP address format
    isValidIP(ip) {
        const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!pattern.test(ip)) return false;
        return ip.split('.').every(octet => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255;
        });
    },

    // Calculate network address from IP and CIDR
    getNetworkAddress(ip, cidr) {
        const ipInt = this.ipToInt(ip);
        const mask = (-1 << (32 - cidr)) >>> 0;
        return this.intToIp((ipInt & mask) >>> 0);
    },

    // Calculate broadcast address
    getBroadcastAddress(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        const hostBits = 32 - cidr;
        const broadcastInt = (networkInt | ((1 << hostBits) - 1)) >>> 0;
        return this.intToIp(broadcastInt);
    },

    // Get total number of usable IPs in subnet
    getTotalHosts(cidr) {
        if (cidr >= 31) return cidr === 31 ? 2 : 1;
        return Math.pow(2, 32 - cidr) - 2; // Exclude network and broadcast
    },

    // Check if IP is within a subnet
    isIPInSubnet(ip, networkIp, cidr) {
        const ipInt = this.ipToInt(ip);
        const networkInt = this.ipToInt(networkIp);
        const mask = (-1 << (32 - cidr)) >>> 0;
        return (ipInt & mask) === (networkInt & mask);
    },

    // Get all usable IPs in a subnet (for small subnets)
    getUsableIPs(networkIp, cidr) {
        const ips = [];
        const networkInt = this.ipToInt(networkIp);
        const totalIPs = Math.pow(2, 32 - cidr);

        // Skip network address (first) and broadcast (last)
        for (let i = 1; i < totalIPs - 1; i++) {
            ips.push(this.intToIp(networkInt + i));
        }
        return ips;
    },

    // Sort IPs
    sortIPs(ips) {
        return ips.sort((a, b) => this.ipToInt(a) - this.ipToInt(b));
    },

    // Find subnet for an IP
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
// Subnet Management
// ============================================

const SubnetManager = {
    // Get all subnets with statistics
    getAll() {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const ips = DB.get(DB.KEYS.IPS);

        return subnets.map(subnet => {
            const subnetIPs = ips.filter(ip => ip.subnetId === subnet.id);
            const assignedCount = subnetIPs.filter(ip => ip.status === 'assigned').length;
            const reservedCount = subnetIPs.filter(ip => ip.status === 'reserved').length;
            const totalHosts = IPUtils.getTotalHosts(subnet.cidr);

            return {
                ...subnet,
                totalHosts,
                assignedCount,
                reservedCount,
                availableCount: totalHosts - assignedCount - reservedCount
            };
        });
    },

    // Get subnet by ID
    getById(id) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        return subnets.find(s => s.id === id);
    },

    // Add new subnet
    add(subnetData) {
        const subnets = DB.get(DB.KEYS.SUBNETS);

        // Validate network address
        if (!IPUtils.isValidIP(subnetData.network)) {
            return { success: false, message: 'Invalid network address' };
        }

        // Calculate proper network address
        const networkAddress = IPUtils.getNetworkAddress(subnetData.network, subnetData.cidr);

        // Check for duplicates
        const exists = subnets.some(s =>
            s.network === networkAddress && s.cidr === subnetData.cidr
        );
        if (exists) {
            return { success: false, message: 'Subnet already exists' };
        }

        const newSubnet = {
            id: DB.generateId(),
            network: networkAddress,
            cidr: parseInt(subnetData.cidr),
            name: subnetData.name || '',
            description: subnetData.description || '',
            vlanId: subnetData.vlanId || null,
            gateway: subnetData.gateway || '',
            dnsServers: subnetData.dnsServers || '',
            createdAt: new Date().toISOString()
        };

        subnets.push(newSubnet);
        DB.set(DB.KEYS.SUBNETS, subnets);

        return { success: true, message: 'Subnet added successfully', subnet: newSubnet };
    },

    // Update subnet
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

    // Delete subnet
    delete(id) {
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const ips = DB.get(DB.KEYS.IPS);

        // Check for assigned IPs
        const assignedIPs = ips.filter(ip => ip.subnetId === id && ip.status === 'assigned');
        if (assignedIPs.length > 0) {
            return { success: false, message: 'Cannot delete subnet with assigned IP addresses' };
        }

        // Remove subnet and its IPs
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
    // Get all IP records with host info
    getAll() {
        const ips = DB.get(DB.KEYS.IPS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const subnets = DB.get(DB.KEYS.SUBNETS);

        return ips.map(ip => {
            const host = ip.hostId ? hosts.find(h => h.id === ip.hostId) : null;
            const subnet = ip.subnetId ? subnets.find(s => s.id === ip.subnetId) : null;

            return {
                ...ip,
                hostName: host ? host.vmName : null,
                hostOS: host ? host.operatingSystem : null,
                hostState: host ? host.state : null,
                subnetName: subnet ? `${subnet.network}/${subnet.cidr}` : null
            };
        });
    },

    // Get next available IP in subnet
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

        // Find first available (skip network address)
        for (let i = 1; i < totalIPs - 1; i++) {
            const candidateIP = IPUtils.intToIp(networkInt + i);
            if (!usedIPs.has(candidateIP)) {
                return candidateIP;
            }
        }

        return null;
    },

    // Assign IP to host
    assign(ipAddress, hostId, subnetId = null) {
        if (!IPUtils.isValidIP(ipAddress)) {
            return { success: false, message: 'Invalid IP address' };
        }

        const ips = DB.get(DB.KEYS.IPS);

        // Find or determine subnet
        if (!subnetId) {
            const subnet = IPUtils.findSubnetForIP(ipAddress);
            if (subnet) {
                subnetId = subnet.id;
            }
        }

        // Check if IP already exists
        const existingIndex = ips.findIndex(ip => ip.ipAddress === ipAddress);

        if (existingIndex !== -1) {
            // Update existing record
            if (ips[existingIndex].status === 'assigned' && ips[existingIndex].hostId !== hostId) {
                return { success: false, message: 'IP already assigned to another host' };
            }
            ips[existingIndex].hostId = hostId;
            ips[existingIndex].status = 'assigned';
            ips[existingIndex].subnetId = subnetId;
            ips[existingIndex].updatedAt = new Date().toISOString();
        } else {
            // Create new record
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

    // Release IP
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

    // Register IP (from CSV import) - links to subnet and deducts availability
    register(ipAddress, hostId = null, status = 'assigned') {
        if (!IPUtils.isValidIP(ipAddress)) {
            return { success: false, message: 'Invalid IP address' };
        }

        const ips = DB.get(DB.KEYS.IPS);
        const subnet = IPUtils.findSubnetForIP(ipAddress);
        const subnetId = subnet ? subnet.id : null;

        // Check if already exists
        const existingIndex = ips.findIndex(ip => ip.ipAddress === ipAddress);

        if (existingIndex !== -1) {
            // Update existing
            ips[existingIndex].hostId = hostId;
            ips[existingIndex].status = status;
            if (subnetId) ips[existingIndex].subnetId = subnetId;
            ips[existingIndex].updatedAt = new Date().toISOString();
        } else {
            // Create new
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

    // Get IPs for a host
    getByHostId(hostId) {
        const ips = DB.get(DB.KEYS.IPS);
        return ips.filter(ip => ip.hostId === hostId);
    },

    // Get IPs for a subnet
    getBySubnetId(subnetId) {
        const ips = DB.get(DB.KEYS.IPS);
        return ips.filter(ip => ip.subnetId === subnetId);
    },

    // Update IP status
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

        // Create new if doesn't exist
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
    // Get all hosts with IP info
    getAll() {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const ips = DB.get(DB.KEYS.IPS);

        return hosts.map(host => {
            const hostIPs = ips.filter(ip => ip.hostId === host.id);
            return {
                ...host,
                ipAddresses: hostIPs.map(ip => ip.ipAddress).join(', ')
            };
        });
    },

    // Get host by ID
    getById(id) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const host = hosts.find(h => h.id === id);
        if (!host) return null;

        const ips = DB.get(DB.KEYS.IPS);
        const hostIPs = ips.filter(ip => ip.hostId === id);

        return {
            ...host,
            ipAddresses: hostIPs.map(ip => ip.ipAddress).join(', ')
        };
    },

    // Get host by VM name
    getByVMName(vmName) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        return hosts.find(h => h.vmName.toLowerCase() === vmName.toLowerCase());
    },

    // Add new host
    add(hostData, ipAssignment = {}) {
        const hosts = DB.get(DB.KEYS.HOSTS);

        const newHost = {
            id: DB.generateId(),
            vmName: hostData.vmName,
            operatingSystem: hostData.operatingSystem || '',
            memoryUsedGB: parseFloat(hostData.memoryUsedGB) || null,
            memoryAvailableGB: parseFloat(hostData.memoryAvailableGB) || null,
            memoryTotalGB: parseFloat(hostData.memoryTotalGB) || null,
            node: hostData.node || '',
            diskSizeGB: parseFloat(hostData.diskSizeGB) || null,
            diskUsedGB: parseFloat(hostData.diskUsedGB) || null,
            state: hostData.state || 'running',
            cpuCount: parseInt(hostData.cpuCount) || null,
            favorite: hostData.favorite ? 1 : 0,
            createdAt: new Date().toISOString()
        };

        hosts.push(newHost);
        DB.set(DB.KEYS.HOSTS, hosts);

        const assignedIPs = [];

        // Handle IP assignment
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
            message: `Host added successfully${assignedIPs.length ? ' with IPs: ' + assignedIPs.join(', ') : ''}`,
            host: newHost,
            assignedIPs
        };
    },

    // Update host
    update(id, updates) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const index = hosts.findIndex(h => h.id === id);

        if (index === -1) {
            return { success: false, message: 'Host not found' };
        }

        // Parse numeric fields
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

    // Delete host
    delete(id) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const ips = DB.get(DB.KEYS.IPS);

        // Release all IPs
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
    // Parse CSV content
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        // Parse header (handle quoted values)
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

    // Import from CSV
    import(content, updateExisting = true) {
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

                // Parse IP addresses
                const ipField = row['IP Addresses'] || '';
                const ipAddresses = ipField.split(',').map(ip => ip.trim()).filter(ip => ip);

                // Check for existing host
                const existingHost = HostManager.getByVMName(vmName);

                if (existingHost) {
                    if (updateExisting) {
                        // Update existing host
                        HostManager.update(existingHost.id, {
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

                        // Register IPs and link to subnets
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
                    // Add new host
                    const hosts = DB.get(DB.KEYS.HOSTS);
                    const newHost = {
                        id: DB.generateId(),
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

                    // Register IPs - this will automatically link to matching subnets
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

    // Export to CSV
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
// UI Functions
// ============================================

// Current sorting state
let currentSort = { field: 'vm_name', direction: 'asc' };

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Navigation
function navigateTo(page) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === page);
    });

    // Refresh page content
    switch (page) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'subnets':
            refreshSubnetsTable();
            break;
        case 'hosts':
            refreshHostsTable();
            populateSubnetFilters();
            break;
        case 'ipam':
            refreshIPsTable();
            populateSubnetFilters();
            break;
        case 'import':
            // Nothing to refresh
            break;
    }
}

// Initialize navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ============================================
// Dashboard
// ============================================

function refreshDashboard() {
    const subnets = SubnetManager.getAll();
    const hosts = HostManager.getAll();

    // Stats
    document.getElementById('totalSubnets').textContent = subnets.length;
    document.getElementById('totalHosts').textContent = hosts.length;
    document.getElementById('runningHosts').textContent = hosts.filter(h => h.state?.toLowerCase() === 'running').length;
    document.getElementById('stoppedHosts').textContent = hosts.filter(h => h.state?.toLowerCase() === 'stopped').length;

    // IP Utilization
    let totalCapacity = 0;
    let totalAssigned = 0;

    subnets.forEach(subnet => {
        totalCapacity += subnet.totalHosts;
        totalAssigned += subnet.assignedCount;
    });

    const usagePercent = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;
    document.getElementById('overallUsagePercent').textContent = `${usagePercent}%`;
    document.getElementById('assignedIPs').textContent = totalAssigned;
    document.getElementById('availableIPs').textContent = totalCapacity - totalAssigned;

    const usageBar = document.getElementById('overallUsageBar');
    usageBar.style.width = `${usagePercent}%`;
    usageBar.classList.toggle('warning', usagePercent >= 70 && usagePercent < 90);
    usageBar.classList.toggle('danger', usagePercent >= 90);

    // Subnet Overview
    const subnetOverview = document.getElementById('subnetOverview');
    if (subnets.length === 0) {
        subnetOverview.innerHTML = '<p class="empty-message">No subnets configured</p>';
    } else {
        subnetOverview.innerHTML = subnets.map(subnet => {
            const usage = subnet.totalHosts > 0 ? Math.round((subnet.assignedCount / subnet.totalHosts) * 100) : 0;
            const barClass = usage >= 90 ? 'danger' : usage >= 70 ? 'warning' : '';
            return `
                <div class="subnet-item">
                    <div class="subnet-item-info">
                        <h4>${subnet.network}/${subnet.cidr}</h4>
                        <span>${subnet.name || 'Unnamed'}</span>
                    </div>
                    <div class="subnet-item-usage">
                        <div class="mini-progress">
                            <div class="fill ${barClass}" style="width: ${usage}%"></div>
                        </div>
                        <span class="usage-value">${subnet.assignedCount}/${subnet.totalHosts}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Recent Hosts
    const recentHosts = hosts.slice(-10).reverse();
    const recentTable = document.getElementById('recentHostsTable').querySelector('tbody');

    if (recentHosts.length === 0) {
        recentTable.innerHTML = '<tr><td colspan="5" class="empty-message">No hosts found</td></tr>';
    } else {
        recentTable.innerHTML = recentHosts.map(host => `
            <tr>
                <td>${escapeHtml(host.vmName)}</td>
                <td>${escapeHtml(host.operatingSystem || '-')}</td>
                <td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>
                <td>${escapeHtml(host.ipAddresses || '-')}</td>
                <td>${escapeHtml(host.node || '-')}</td>
            </tr>
        `).join('');
    }
}

// ============================================
// Subnet Management UI
// ============================================

function refreshSubnetsTable() {
    const subnets = SubnetManager.getAll();
    const tbody = document.getElementById('subnetsTable').querySelector('tbody');

    if (subnets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">No subnets configured</td></tr>';
        return;
    }

    tbody.innerHTML = subnets.map(subnet => {
        const usage = subnet.totalHosts > 0 ? Math.round((subnet.assignedCount / subnet.totalHosts) * 100) : 0;
        const barClass = usage >= 90 ? 'danger' : usage >= 70 ? 'warning' : '';
        return `
            <tr>
                <td><strong>${subnet.network}/${subnet.cidr}</strong></td>
                <td>${escapeHtml(subnet.name || '-')}</td>
                <td>${subnet.vlanId || '-'}</td>
                <td>${escapeHtml(subnet.gateway || '-')}</td>
                <td>${subnet.totalHosts}</td>
                <td>${subnet.assignedCount}</td>
                <td>${subnet.availableCount}</td>
                <td>
                    <div class="mini-progress" title="${usage}%">
                        <div class="fill ${barClass}" style="width: ${usage}%"></div>
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

function showAddSubnetModal() {
    document.getElementById('subnetForm').reset();
    document.getElementById('subnetEditId').value = '';
    document.querySelector('#addSubnetModal .modal-header h3').textContent = 'Add Subnet';
    openModal('addSubnetModal');
}

function editSubnet(id) {
    const subnet = SubnetManager.getById(id);
    if (!subnet) return;

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
    const subnetData = {
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
        result = SubnetManager.update(id, subnetData);
    } else {
        result = SubnetManager.add(subnetData);
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

    // Create a map of used IPs
    const ipMap = new Map();
    ips.forEach(ip => {
        const host = ip.hostId ? hosts.find(h => h.id === ip.hostId) : null;
        ipMap.set(ip.ipAddress, { status: ip.status, hostName: host?.vmName });
    });

    // Generate IP list for the subnet
    const content = document.getElementById('subnetIPsContent');
    const subnetInfo = SubnetManager.getAll().find(s => s.id === subnetId);

    let html = `
        <div style="margin-bottom: 20px;">
            <h4>${subnet.network}/${subnet.cidr} ${subnet.name ? `(${subnet.name})` : ''}</h4>
            <p>Total: ${subnetInfo.totalHosts} | Assigned: ${subnetInfo.assignedCount} | Available: ${subnetInfo.availableCount}</p>
        </div>
        <div class="ip-list-grid">
    `;

    // Get all usable IPs (limit display for large subnets)
    const networkInt = IPUtils.ipToInt(subnet.network);
    const totalIPs = Math.pow(2, 32 - subnet.cidr);
    const maxDisplay = Math.min(totalIPs - 2, 254); // Limit to 254 IPs for display

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
// Host Management UI
// ============================================

function refreshHostsTable() {
    let hosts = HostManager.getAll();

    // Apply sorting
    hosts = sortData(hosts, currentSort.field, currentSort.direction);

    const tbody = document.getElementById('hostsTable').querySelector('tbody');

    if (hosts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">No hosts found</td></tr>';
        return;
    }

    tbody.innerHTML = hosts.map(host => {
        const memoryDisplay = host.memoryTotalGB
            ? `${host.memoryUsedGB || 0}/${host.memoryTotalGB} GB`
            : '-';
        const diskDisplay = host.diskSizeGB
            ? `${host.diskUsedGB || 0}/${host.diskSizeGB} GB`
            : '-';

        return `
            <tr data-id="${host.id}" data-state="${host.state?.toLowerCase()}" data-ips="${host.ipAddresses}">
                <td><strong>${escapeHtml(host.vmName)}</strong>${host.favorite ? ' ⭐' : ''}</td>
                <td>${escapeHtml(host.operatingSystem || '-')}</td>
                <td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>
                <td>${escapeHtml(host.node || '-')}</td>
                <td>${host.cpuCount || '-'}</td>
                <td>${memoryDisplay}</td>
                <td>${diskDisplay}</td>
                <td>${escapeHtml(host.ipAddresses || '-')}</td>
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
}

function populateSubnetFilters() {
    const subnets = SubnetManager.getAll();
    const options = '<option value="">All Subnets</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr} ${s.name ? `(${s.name})` : ''}</option>`).join('');

    const hostFilter = document.getElementById('hostSubnetFilter');
    const ipFilter = document.getElementById('ipSubnetFilter');
    const autoSubnet = document.getElementById('hostAutoSubnet');

    if (hostFilter) hostFilter.innerHTML = options;
    if (ipFilter) ipFilter.innerHTML = options;
    if (autoSubnet) {
        autoSubnet.innerHTML = '<option value="">-- Select Subnet --</option>' +
            subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr} - ${s.availableCount} available</option>`).join('');
    }
}

function filterHosts() {
    const search = document.getElementById('hostSearchInput').value.toLowerCase();
    const stateFilter = document.getElementById('hostStateFilter').value.toLowerCase();
    const subnetFilter = document.getElementById('hostSubnetFilter').value;

    const rows = document.querySelectorAll('#hostsTable tbody tr[data-id]');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const state = row.dataset.state;
        const ips = row.dataset.ips || '';

        let visible = true;

        if (search && !text.includes(search)) visible = false;
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
    document.getElementById('ipAssignmentMethod').value = 'auto';
    toggleIPAssignment();
    populateSubnetFilters();

    document.querySelector('#addHostModal .modal-header h3').textContent = 'Add Host';
    openModal('addHostModal');
}

function toggleIPAssignment() {
    const method = document.getElementById('ipAssignmentMethod').value;
    document.getElementById('autoAssignSection').style.display = method === 'auto' ? 'block' : 'none';
    document.getElementById('manualIPSection').style.display = method === 'manual' ? 'block' : 'none';

    if (method === 'auto') {
        updateNextIPPreview();
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

    document.getElementById('ipAssignmentMethod').value = 'none';
    toggleIPAssignment();

    document.querySelector('#addHostModal .modal-header h3').textContent = 'Edit Host';
    openModal('addHostModal');
}

function saveHost(e) {
    e.preventDefault();

    const id = document.getElementById('hostEditId').value;
    const hostData = {
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

    // Calculate available memory
    if (hostData.memoryTotalGB && hostData.memoryUsedGB) {
        hostData.memoryAvailableGB = parseFloat(hostData.memoryTotalGB) - parseFloat(hostData.memoryUsedGB);
    }

    let result;
    if (id) {
        result = HostManager.update(id, hostData);
    } else {
        const ipMethod = document.getElementById('ipAssignmentMethod').value;
        const ipAssignment = {
            method: ipMethod,
            subnetId: ipMethod === 'auto' ? document.getElementById('hostAutoSubnet').value : null,
            ips: ipMethod === 'manual' ? document.getElementById('hostManualIPs').value : null
        };
        result = HostManager.add(hostData, ipAssignment);
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
                <div class="value">${host.memoryUsedGB || 0} / ${host.memoryTotalGB || 0} GB used</div>
            </div>
            <div class="detail-item">
                <label>Disk</label>
                <div class="value">${host.diskUsedGB || 0} / ${host.diskSizeGB || 0} GB used</div>
            </div>
            <div class="detail-item">
                <label>Created</label>
                <div class="value">${host.createdAt ? new Date(host.createdAt).toLocaleString() : '-'}</div>
            </div>
            <div class="detail-item full-width">
                <label>IP Addresses</label>
                <div class="value">${escapeHtml(host.ipAddresses || 'None assigned')}</div>
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

    // Sort by IP
    ips = ips.sort((a, b) => IPUtils.ipToInt(a.ipAddress) - IPUtils.ipToInt(b.ipAddress));

    const tbody = document.getElementById('ipsTable').querySelector('tbody');

    if (ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">No IP addresses tracked</td></tr>';
        return;
    }

    tbody.innerHTML = ips.map(ip => `
        <tr data-subnet="${ip.subnetId || ''}" data-status="${ip.status}">
            <td><strong style="font-family: monospace;">${ip.ipAddress}</strong></td>
            <td>${escapeHtml(ip.subnetName || '-')}</td>
            <td><span class="status-badge ${ip.status}">${ip.status}</span></td>
            <td>${escapeHtml(ip.hostName || '-')}</td>
            <td>${escapeHtml(ip.hostOS || '-')}</td>
            <td>${ip.hostState ? `<span class="status-badge ${ip.hostState.toLowerCase()}">${ip.hostState}</span>` : '-'}</td>
            <td>
                <div class="action-btns">
                    ${ip.status === 'assigned'
                        ? `<button class="btn-icon delete" onclick="releaseIP('${ip.ipAddress}')" title="Release">🔓</button>`
                        : `<button class="btn-icon edit" onclick="editIPAssignment('${ip.ipAddress}')" title="Assign">🔗</button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');
}

function filterIPs() {
    const search = document.getElementById('ipSearchInput').value.toLowerCase();
    const subnetFilter = document.getElementById('ipSubnetFilter').value;
    const statusFilter = document.getElementById('ipStatusFilter').value;

    const rows = document.querySelectorAll('#ipsTable tbody tr[data-subnet]');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const subnet = row.dataset.subnet;
        const status = row.dataset.status;

        let visible = true;

        if (search && !text.includes(search)) visible = false;
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
        hosts.map(h => `<option value="${h.id}">${h.vmName}</option>`).join('');
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

// File upload handling
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
        const updateExisting = document.getElementById('updateExisting').checked;

        const result = CSVManager.import(content, updateExisting);

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
        version: 1,
        timestamp: new Date().toISOString(),
        subnets: DB.get(DB.KEYS.SUBNETS),
        hosts: DB.get(DB.KEYS.HOSTS),
        ips: DB.get(DB.KEYS.IPS)
    };

    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, `ip_database_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
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

// Close modal on escape key
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
document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
        DB.clearAll();
        showToast('All data cleared', 'info');
        navigateTo('dashboard');
    }
});

// ============================================
// Initialize Application
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    console.log('IP Database initialized');
});
