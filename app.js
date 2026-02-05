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
        IPS: 'ipdb_ips',
        VLANS: 'ipdb_vlans',
        IP_RANGES: 'ipdb_ip_ranges',
        SUBNET_TEMPLATES: 'ipdb_subnet_templates',
        RESERVATIONS: 'ipdb_reservations',
        AUDIT_LOG: 'ipdb_audit_log',
        SETTINGS: 'ipdb_settings',
        IP_HISTORY: 'ipdb_ip_history',
        MAINTENANCE_WINDOWS: 'ipdb_maintenance_windows'
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
    },

    getFirstUsableIP(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        return this.intToIp(networkInt + 1);
    },

    getLastUsableIP(networkIp, cidr) {
        const networkInt = this.ipToInt(networkIp);
        const totalIPs = Math.pow(2, 32 - cidr);
        return this.intToIp(networkInt + totalIPs - 2);
    }
};

// ============================================
// VLAN Management
// ============================================

const VLAN_TYPES = [
    { id: 'data', name: 'Data', color: '#3b82f6' },
    { id: 'voice', name: 'Voice', color: '#10b981' },
    { id: 'management', name: 'Management', color: '#f59e0b' },
    { id: 'dmz', name: 'DMZ', color: '#ef4444' },
    { id: 'guest', name: 'Guest', color: '#8b5cf6' },
    { id: 'iot', name: 'IoT', color: '#06b6d4' },
    { id: 'storage', name: 'Storage', color: '#ec4899' },
    { id: 'backup', name: 'Backup', color: '#64748b' },
    { id: 'other', name: 'Other', color: '#6b7280' }
];

const VLANManager = {
    getAll() {
        const vlans = DB.get(DB.KEYS.VLANS);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const companies = DB.get(DB.KEYS.COMPANIES);

        return vlans.map(vlan => {
            const vlanSubnets = subnets.filter(s => s.vlanId == vlan.vlanId);
            const company = companies.find(c => c.id === vlan.companyId);
            const vlanType = VLAN_TYPES.find(t => t.id === vlan.type) || VLAN_TYPES.find(t => t.id === 'other');

            return {
                ...vlan,
                subnetCount: vlanSubnets.length,
                companyName: company ? company.name : 'Unassigned',
                companyColor: company ? company.color : '#6b7280',
                typeName: vlanType.name,
                typeColor: vlanType.color
            };
        });
    },

    getById(id) {
        const vlans = DB.get(DB.KEYS.VLANS);
        return vlans.find(v => v.id === id);
    },

    getByVlanId(vlanId) {
        const vlans = DB.get(DB.KEYS.VLANS);
        return vlans.find(v => v.vlanId == vlanId);
    },

    add(data) {
        const vlans = DB.get(DB.KEYS.VLANS);

        const exists = vlans.some(v => v.vlanId == data.vlanId);
        if (exists) {
            return { success: false, message: 'VLAN ID already exists' };
        }

        const newVLAN = {
            id: DB.generateId(),
            vlanId: parseInt(data.vlanId),
            name: data.name,
            description: data.description || '',
            type: data.type || 'data',
            companyId: data.companyId || null,
            createdAt: new Date().toISOString()
        };

        vlans.push(newVLAN);
        DB.set(DB.KEYS.VLANS, vlans);

        return { success: true, message: 'VLAN added successfully', vlan: newVLAN };
    },

    update(id, updates) {
        const vlans = DB.get(DB.KEYS.VLANS);
        const index = vlans.findIndex(v => v.id === id);

        if (index === -1) {
            return { success: false, message: 'VLAN not found' };
        }

        vlans[index] = { ...vlans[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.VLANS, vlans);

        return { success: true, message: 'VLAN updated successfully' };
    },

    delete(id) {
        const vlans = DB.get(DB.KEYS.VLANS);
        const vlan = vlans.find(v => v.id === id);
        if (!vlan) {
            return { success: false, message: 'VLAN not found' };
        }

        const subnets = DB.get(DB.KEYS.SUBNETS);
        const hasSubnets = subnets.some(s => s.vlanId == vlan.vlanId);

        if (hasSubnets) {
            return { success: false, message: 'Cannot delete VLAN with associated subnets' };
        }

        const newVLANs = vlans.filter(v => v.id !== id);
        DB.set(DB.KEYS.VLANS, newVLANs);

        return { success: true, message: 'VLAN deleted successfully' };
    }
};

// ============================================
// IP Range Allocation Management
// ============================================

const RANGE_PURPOSES = [
    { id: 'servers', name: 'Servers', icon: '🖥️', color: '#3b82f6' },
    { id: 'workstations', name: 'Workstations', icon: '💻', color: '#10b981' },
    { id: 'printers', name: 'Printers', icon: '🖨️', color: '#f59e0b' },
    { id: 'iot', name: 'IoT Devices', icon: '📡', color: '#06b6d4' },
    { id: 'voip', name: 'VoIP Phones', icon: '📞', color: '#8b5cf6' },
    { id: 'cameras', name: 'Cameras/NVR', icon: '📷', color: '#64748b' },
    { id: 'network', name: 'Network Equipment', icon: '🔌', color: '#ef4444' },
    { id: 'dhcp', name: 'DHCP Pool', icon: '🔄', color: '#14b8a6' },
    { id: 'static', name: 'Static Assignments', icon: '📌', color: '#ec4899' },
    { id: 'reserved', name: 'Reserved', icon: '🔒', color: '#6b7280' },
    { id: 'other', name: 'Other', icon: '📦', color: '#475569' }
];

const IPRangeManager = {
    getAll() {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        const subnets = DB.get(DB.KEYS.SUBNETS);
        const ips = DB.get(DB.KEYS.IPS);

        return ranges.map(range => {
            const subnet = subnets.find(s => s.id === range.subnetId);
            const purpose = RANGE_PURPOSES.find(p => p.id === range.purpose) || RANGE_PURPOSES.find(p => p.id === 'other');

            // Calculate usage
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

        // Check for overlapping ranges in same subnet
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

        return { success: true, message: 'IP range added successfully', range: newRange };
    },

    update(id, updates) {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        const index = ranges.findIndex(r => r.id === id);

        if (index === -1) {
            return { success: false, message: 'IP range not found' };
        }

        ranges[index] = { ...ranges[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.IP_RANGES, ranges);

        return { success: true, message: 'IP range updated successfully' };
    },

    delete(id) {
        const ranges = DB.get(DB.KEYS.IP_RANGES);
        const newRanges = ranges.filter(r => r.id !== id);
        DB.set(DB.KEYS.IP_RANGES, newRanges);

        return { success: true, message: 'IP range deleted successfully' };
    }
};

// ============================================
// Subnet Templates Management
// ============================================

const DEFAULT_TEMPLATES = [
    {
        id: 'small_office',
        name: 'Small Office',
        description: 'Small office network (254 hosts)',
        cidr: 24,
        vlanType: 'data',
        ranges: [
            { startOffset: 1, endOffset: 10, purpose: 'network', name: 'Network Infrastructure' },
            { startOffset: 11, endOffset: 50, purpose: 'servers', name: 'Servers' },
            { startOffset: 51, endOffset: 200, purpose: 'dhcp', name: 'DHCP Pool' },
            { startOffset: 201, endOffset: 230, purpose: 'printers', name: 'Printers' },
            { startOffset: 231, endOffset: 254, purpose: 'reserved', name: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' },
            { offset: 2, type: 'dns', description: 'Primary DNS' },
            { offset: 3, type: 'dns', description: 'Secondary DNS' }
        ]
    },
    {
        id: 'datacenter',
        name: 'Datacenter',
        description: 'Server network (254 hosts)',
        cidr: 24,
        vlanType: 'data',
        ranges: [
            { startOffset: 1, endOffset: 5, purpose: 'network', name: 'Network Infrastructure' },
            { startOffset: 6, endOffset: 200, purpose: 'servers', name: 'Servers' },
            { startOffset: 201, endOffset: 250, purpose: 'static', name: 'Static IPs' },
            { startOffset: 251, endOffset: 254, purpose: 'reserved', name: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' }
        ]
    },
    {
        id: 'iot_network',
        name: 'IoT Network',
        description: 'IoT devices network (254 hosts)',
        cidr: 24,
        vlanType: 'iot',
        ranges: [
            { startOffset: 1, endOffset: 5, purpose: 'network', name: 'Network Infrastructure' },
            { startOffset: 6, endOffset: 50, purpose: 'cameras', name: 'Cameras' },
            { startOffset: 51, endOffset: 150, purpose: 'iot', name: 'IoT Devices' },
            { startOffset: 151, endOffset: 200, purpose: 'dhcp', name: 'DHCP Pool' },
            { startOffset: 201, endOffset: 254, purpose: 'reserved', name: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' }
        ]
    },
    {
        id: 'voice_network',
        name: 'Voice/VoIP',
        description: 'VoIP network (254 hosts)',
        cidr: 24,
        vlanType: 'voice',
        ranges: [
            { startOffset: 1, endOffset: 5, purpose: 'network', name: 'Network Infrastructure' },
            { startOffset: 6, endOffset: 200, purpose: 'voip', name: 'VoIP Phones' },
            { startOffset: 201, endOffset: 254, purpose: 'reserved', name: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' }
        ]
    },
    {
        id: 'dmz',
        name: 'DMZ',
        description: 'DMZ for public services (62 hosts)',
        cidr: 26,
        vlanType: 'dmz',
        ranges: [
            { startOffset: 1, endOffset: 5, purpose: 'network', name: 'Network Infrastructure' },
            { startOffset: 6, endOffset: 50, purpose: 'servers', name: 'Public Servers' },
            { startOffset: 51, endOffset: 62, purpose: 'reserved', name: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' },
            { offset: 2, type: 'firewall', description: 'Firewall' }
        ]
    },
    {
        id: 'guest',
        name: 'Guest Network',
        description: 'Guest WiFi network (254 hosts)',
        cidr: 24,
        vlanType: 'guest',
        ranges: [
            { startOffset: 1, endOffset: 5, purpose: 'network', name: 'Network Infrastructure' },
            { startOffset: 6, endOffset: 250, purpose: 'dhcp', name: 'DHCP Pool' },
            { startOffset: 251, endOffset: 254, purpose: 'reserved', name: 'Reserved' }
        ],
        reservations: [
            { offset: 1, type: 'gateway', description: 'Default Gateway' }
        ]
    }
];

const SubnetTemplateManager = {
    getAll() {
        const customTemplates = DB.get(DB.KEYS.SUBNET_TEMPLATES);
        return [...DEFAULT_TEMPLATES, ...customTemplates];
    },

    getById(id) {
        return this.getAll().find(t => t.id === id);
    },

    add(data) {
        const templates = DB.get(DB.KEYS.SUBNET_TEMPLATES);

        const newTemplate = {
            id: DB.generateId(),
            name: data.name,
            description: data.description || '',
            cidr: parseInt(data.cidr),
            vlanType: data.vlanType || 'data',
            ranges: data.ranges || [],
            reservations: data.reservations || [],
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        templates.push(newTemplate);
        DB.set(DB.KEYS.SUBNET_TEMPLATES, templates);

        return { success: true, message: 'Template added successfully', template: newTemplate };
    },

    delete(id) {
        // Can only delete custom templates
        const templates = DB.get(DB.KEYS.SUBNET_TEMPLATES);
        const template = templates.find(t => t.id === id);

        if (!template) {
            return { success: false, message: 'Template not found or is a default template' };
        }

        const newTemplates = templates.filter(t => t.id !== id);
        DB.set(DB.KEYS.SUBNET_TEMPLATES, newTemplates);

        return { success: true, message: 'Template deleted successfully' };
    },

    applyTemplate(templateId, subnetId) {
        const template = this.getById(templateId);
        const subnet = SubnetManager.getById(subnetId);

        if (!template || !subnet) {
            return { success: false, message: 'Template or subnet not found' };
        }

        const networkInt = IPUtils.ipToInt(subnet.network);
        const results = { ranges: 0, reservations: 0 };

        // Create IP ranges from template
        if (template.ranges) {
            template.ranges.forEach(range => {
                const startIP = IPUtils.intToIp(networkInt + range.startOffset);
                const endIP = IPUtils.intToIp(networkInt + range.endOffset);

                const result = IPRangeManager.add({
                    subnetId: subnetId,
                    startIP: startIP,
                    endIP: endIP,
                    purpose: range.purpose,
                    name: range.name,
                    description: range.description || ''
                });

                if (result.success) results.ranges++;
            });
        }

        // Create reservations from template
        if (template.reservations) {
            template.reservations.forEach(res => {
                const ip = IPUtils.intToIp(networkInt + res.offset);

                const result = IPManager.updateStatus(ip, 'reserved', null);
                if (result.success) {
                    // Update IP with reservation info
                    const ips = DB.get(DB.KEYS.IPS);
                    const ipRecord = ips.find(i => i.ipAddress === ip);
                    if (ipRecord) {
                        ipRecord.reservationType = res.type;
                        ipRecord.reservationDescription = res.description;
                        DB.set(DB.KEYS.IPS, ips);
                    }
                    results.reservations++;
                }
            });
        }

        return {
            success: true,
            message: `Template applied: ${results.ranges} ranges, ${results.reservations} reservations created`
        };
    }
};

// ============================================
// IP Conflict Detection
// ============================================

const ConflictDetector = {
    checkForConflicts() {
        const ips = DB.get(DB.KEYS.IPS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const conflicts = [];

        // Group IPs by address
        const ipGroups = {};
        ips.forEach(ip => {
            if (!ipGroups[ip.ipAddress]) {
                ipGroups[ip.ipAddress] = [];
            }
            ipGroups[ip.ipAddress].push(ip);
        });

        // Find duplicates
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

        // Check for IPs outside their subnets
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

        // Check for gateway/broadcast assignments
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

// ============================================
// Reservation Types
// ============================================

const RESERVATION_TYPES = [
    { id: 'gateway', name: 'Gateway', icon: '🚪', color: '#ef4444' },
    { id: 'dns', name: 'DNS Server', icon: '🔍', color: '#3b82f6' },
    { id: 'dhcp', name: 'DHCP Server', icon: '🔄', color: '#10b981' },
    { id: 'firewall', name: 'Firewall', icon: '🛡️', color: '#f59e0b' },
    { id: 'switch', name: 'Switch/Router', icon: '🔌', color: '#8b5cf6' },
    { id: 'ap', name: 'Access Point', icon: '📶', color: '#06b6d4' },
    { id: 'management', name: 'Management', icon: '⚙️', color: '#64748b' },
    { id: 'future', name: 'Future Use', icon: '🔮', color: '#ec4899' },
    { id: 'other', name: 'Other', icon: '📌', color: '#6b7280' }
];

// ============================================
// Audit Log Management
// ============================================

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

        // Keep only last MAX_ENTRIES
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

// ============================================
// Settings Management (Dark Mode, etc.)
// ============================================

const Settings = {
    defaults: {
        darkMode: false,
        compactView: false,
        showAuditLog: true
    },

    get(key) {
        const settings = this.getAll();
        return settings[key] !== undefined ? settings[key] : this.defaults[key];
    },

    set(key, value) {
        const settings = this.getAll();
        settings[key] = value;
        localStorage.setItem(DB.KEYS.SETTINGS, JSON.stringify(settings));

        // Log settings change
        AuditLog.log('update', 'settings', key, `Changed ${key} to ${value}`);
    },

    getAll() {
        const stored = localStorage.getItem(DB.KEYS.SETTINGS);
        return stored ? JSON.parse(stored) : { ...this.defaults };
    },

    reset() {
        localStorage.setItem(DB.KEYS.SETTINGS, JSON.stringify(this.defaults));
    }
};

// ============================================
// Subnet Calculator
// ============================================

const SubnetCalculator = {
    calculate(ip, cidr) {
        if (!IPUtils.isValidIP(ip)) {
            return { error: 'Invalid IP address' };
        }

        cidr = parseInt(cidr);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) {
            return { error: 'Invalid CIDR (must be 0-32)' };
        }

        const networkAddress = IPUtils.getNetworkAddress(ip, cidr);
        const broadcastAddress = IPUtils.getBroadcastAddress(networkAddress, cidr);
        const totalHosts = IPUtils.getTotalHosts(cidr);

        const networkInt = IPUtils.ipToInt(networkAddress);
        const firstUsable = cidr < 31 ? IPUtils.intToIp(networkInt + 1) : networkAddress;
        const lastUsable = cidr < 31 ? IPUtils.intToIp(networkInt + totalHosts) : broadcastAddress;

        // Calculate subnet mask
        const maskInt = (-1 << (32 - cidr)) >>> 0;
        const subnetMask = IPUtils.intToIp(maskInt);

        // Wildcard mask (inverse)
        const wildcardInt = ~maskInt >>> 0;
        const wildcardMask = IPUtils.intToIp(wildcardInt);

        // IP class
        const firstOctet = parseInt(ip.split('.')[0]);
        let ipClass = 'E';
        if (firstOctet >= 1 && firstOctet <= 126) ipClass = 'A';
        else if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'B';
        else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'C';
        else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'D (Multicast)';

        // Private/Public
        const isPrivate = this.isPrivateIP(ip);

        return {
            inputIP: ip,
            cidr,
            networkAddress,
            broadcastAddress,
            subnetMask,
            wildcardMask,
            firstUsableIP: firstUsable,
            lastUsableIP: lastUsable,
            totalHosts,
            usableHosts: cidr < 31 ? totalHosts : (cidr === 31 ? 2 : 1),
            ipClass,
            isPrivate,
            binaryMask: this.toBinary(maskInt),
            notation: `${networkAddress}/${cidr}`
        };
    },

    isPrivateIP(ip) {
        const parts = ip.split('.').map(Number);
        // 10.0.0.0/8
        if (parts[0] === 10) return true;
        // 172.16.0.0/12
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return true;
        return false;
    },

    toBinary(num) {
        return (num >>> 0).toString(2).padStart(32, '0').match(/.{8}/g).join('.');
    },

    // Calculate supernet (combine multiple subnets)
    calculateSupernet(subnets) {
        if (!subnets || subnets.length < 2) {
            return { error: 'Need at least 2 subnets' };
        }

        // Find the smallest CIDR that encompasses all
        let minIP = Infinity;
        let maxIP = 0;

        subnets.forEach(s => {
            const networkInt = IPUtils.ipToInt(s.network);
            const broadcastInt = IPUtils.ipToInt(IPUtils.getBroadcastAddress(s.network, s.cidr));
            minIP = Math.min(minIP, networkInt);
            maxIP = Math.max(maxIP, broadcastInt);
        });

        // Calculate required CIDR
        const range = maxIP - minIP + 1;
        const bitsNeeded = Math.ceil(Math.log2(range));
        const newCidr = 32 - bitsNeeded;

        const newNetwork = IPUtils.getNetworkAddress(IPUtils.intToIp(minIP), newCidr);

        return {
            network: newNetwork,
            cidr: newCidr,
            notation: `${newNetwork}/${newCidr}`,
            totalHosts: IPUtils.getTotalHosts(newCidr)
        };
    },

    // Split subnet into smaller subnets
    splitSubnet(network, cidr, newCidr) {
        if (newCidr <= cidr) {
            return { error: 'New CIDR must be larger than current' };
        }

        const numSubnets = Math.pow(2, newCidr - cidr);
        const subnets = [];
        const baseInt = IPUtils.ipToInt(network);
        const subnetSize = Math.pow(2, 32 - newCidr);

        for (let i = 0; i < numSubnets; i++) {
            const subnetNetwork = IPUtils.intToIp(baseInt + (i * subnetSize));
            subnets.push({
                network: subnetNetwork,
                cidr: newCidr,
                notation: `${subnetNetwork}/${newCidr}`,
                totalHosts: IPUtils.getTotalHosts(newCidr)
            });
        }

        return { subnets };
    }
};

// ============================================
// MAC Address Utilities
// ============================================

const MACUtils = {
    isValidMAC(mac) {
        if (!mac) return false;
        // Accept formats: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, AABBCCDDEEFF
        const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
        return /^[0-9A-F]{12}$/.test(cleaned);
    },

    formatMAC(mac, separator = ':') {
        if (!mac) return '';
        const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
        if (cleaned.length !== 12) return mac;
        return cleaned.match(/.{2}/g).join(separator);
    },

    getVendor(mac) {
        // This would typically call an API or use a local OUI database
        // For now, just return the OUI prefix
        const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
        return cleaned.substring(0, 6);
    }
};

// ============================================
// Hardware Lifecycle Constants
// ============================================

const LIFECYCLE_STATUS = [
    { id: 'active', name: 'Active', color: '#22c55e', icon: '✓' },
    { id: 'warranty', name: 'Under Warranty', color: '#3b82f6', icon: '🛡️' },
    { id: 'expiring', name: 'Warranty Expiring', color: '#f59e0b', icon: '⚠️' },
    { id: 'out_of_warranty', name: 'Out of Warranty', color: '#ef4444', icon: '⏰' },
    { id: 'eol_announced', name: 'EOL Announced', color: '#f97316', icon: '📢' },
    { id: 'eol', name: 'End of Life', color: '#dc2626', icon: '🚫' },
    { id: 'decommissioned', name: 'Decommissioned', color: '#6b7280', icon: '🗑️' },
    { id: 'refresh_planned', name: 'Refresh Planned', color: '#8b5cf6', icon: '🔄' }
];

const MAINTENANCE_TYPES = [
    { id: 'scheduled', name: 'Scheduled Maintenance', color: '#3b82f6', icon: '📅' },
    { id: 'emergency', name: 'Emergency Maintenance', color: '#ef4444', icon: '🚨' },
    { id: 'patch', name: 'Patch/Update', color: '#22c55e', icon: '🔧' },
    { id: 'firmware', name: 'Firmware Update', color: '#8b5cf6', icon: '💾' },
    { id: 'hardware', name: 'Hardware Maintenance', color: '#f59e0b', icon: '🔩' },
    { id: 'network', name: 'Network Maintenance', color: '#06b6d4', icon: '🌐' },
    { id: 'security', name: 'Security Update', color: '#dc2626', icon: '🔒' },
    { id: 'backup', name: 'Backup Window', color: '#84cc16', icon: '💿' }
];

const MAINTENANCE_STATUS = [
    { id: 'scheduled', name: 'Scheduled', color: '#3b82f6' },
    { id: 'in_progress', name: 'In Progress', color: '#f59e0b' },
    { id: 'completed', name: 'Completed', color: '#22c55e' },
    { id: 'cancelled', name: 'Cancelled', color: '#6b7280' },
    { id: 'failed', name: 'Failed', color: '#ef4444' }
];

// ============================================
// IP History Tracking
// ============================================

const IPHistory = {
    MAX_ENTRIES_PER_IP: 100,

    record(ipAddress, action, data) {
        const history = DB.get(DB.KEYS.IP_HISTORY);

        const entry = {
            id: DB.generateId(),
            ipAddress,
            action, // 'assigned', 'released', 'reserved', 'changed', 'created'
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

        // Trim old entries per IP
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

        // Process in reverse chronological order
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

        // If still assigned
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

        // Activity by day (last 30 days)
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

// ============================================
// Maintenance Windows Management
// ============================================

const MaintenanceManager = {
    getAll() {
        const windows = DB.get(DB.KEYS.MAINTENANCE_WINDOWS);
        const hosts = DB.get(DB.KEYS.HOSTS);
        const subnets = DB.get(DB.KEYS.SUBNETS);

        return windows.map(mw => {
            const affectedHosts = mw.hostIds ? mw.hostIds.map(id => {
                const host = hosts.find(h => h.id === id);
                return host ? host.vmName : 'Unknown';
            }) : [];

            const affectedSubnets = mw.subnetIds ? mw.subnetIds.map(id => {
                const subnet = subnets.find(s => s.id === id);
                return subnet ? `${subnet.networkAddress}/${subnet.cidr}` : 'Unknown';
            }) : [];

            const type = MAINTENANCE_TYPES.find(t => t.id === mw.type) || MAINTENANCE_TYPES[0];
            const status = MAINTENANCE_STATUS.find(s => s.id === mw.status) || MAINTENANCE_STATUS[0];

            return {
                ...mw,
                affectedHostNames: affectedHosts,
                affectedSubnetNames: affectedSubnets,
                typeName: type.name,
                typeIcon: type.icon,
                typeColor: type.color,
                statusName: status.name,
                statusColor: status.color,
                isActive: this.isActive(mw),
                isUpcoming: this.isUpcoming(mw),
                isPast: this.isPast(mw)
            };
        }).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    },

    getById(id) {
        const windows = DB.get(DB.KEYS.MAINTENANCE_WINDOWS);
        return windows.find(mw => mw.id === id);
    },

    getUpcoming(days = 7) {
        const all = this.getAll();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        return all.filter(mw => {
            const startTime = new Date(mw.startTime);
            return startTime >= new Date() && startTime <= futureDate && mw.status === 'scheduled';
        });
    },

    getActive() {
        return this.getAll().filter(mw => this.isActive(mw));
    },

    getByHost(hostId) {
        const all = this.getAll();
        return all.filter(mw => mw.hostIds && mw.hostIds.includes(hostId));
    },

    getBySubnet(subnetId) {
        const all = this.getAll();
        return all.filter(mw => mw.subnetIds && mw.subnetIds.includes(subnetId));
    },

    isActive(mw) {
        const now = new Date();
        const start = new Date(mw.startTime);
        const end = new Date(mw.endTime);
        return now >= start && now <= end && mw.status === 'in_progress';
    },

    isUpcoming(mw) {
        const now = new Date();
        const start = new Date(mw.startTime);
        return start > now && mw.status === 'scheduled';
    },

    isPast(mw) {
        const now = new Date();
        const end = new Date(mw.endTime);
        return end < now;
    },

    add(data) {
        const windows = DB.get(DB.KEYS.MAINTENANCE_WINDOWS);

        const newWindow = {
            id: DB.generateId(),
            title: data.title,
            description: data.description || '',
            type: data.type || 'scheduled',
            status: 'scheduled',
            startTime: data.startTime,
            endTime: data.endTime,
            hostIds: data.hostIds || [],
            subnetIds: data.subnetIds || [],
            impact: data.impact || 'partial', // 'none', 'partial', 'full'
            notifyBefore: data.notifyBefore || 24, // hours
            recurring: data.recurring || false,
            recurringPattern: data.recurringPattern || null, // 'daily', 'weekly', 'monthly'
            notes: data.notes || '',
            createdAt: new Date().toISOString(),
            createdBy: data.createdBy || 'system'
        };

        windows.push(newWindow);
        DB.set(DB.KEYS.MAINTENANCE_WINDOWS, windows);

        AuditLog.log('create', 'maintenance', newWindow.id,
            `Created maintenance window: ${newWindow.title}`, null, newWindow);

        return { success: true, window: newWindow };
    },

    update(id, data) {
        const windows = DB.get(DB.KEYS.MAINTENANCE_WINDOWS);
        const index = windows.findIndex(mw => mw.id === id);

        if (index === -1) {
            return { success: false, message: 'Maintenance window not found' };
        }

        const oldWindow = { ...windows[index] };
        windows[index] = {
            ...windows[index],
            ...data,
            updatedAt: new Date().toISOString()
        };

        DB.set(DB.KEYS.MAINTENANCE_WINDOWS, windows);

        AuditLog.log('update', 'maintenance', id,
            `Updated maintenance window: ${windows[index].title}`, oldWindow, windows[index]);

        return { success: true, window: windows[index] };
    },

    updateStatus(id, status, notes = '') {
        const windows = DB.get(DB.KEYS.MAINTENANCE_WINDOWS);
        const index = windows.findIndex(mw => mw.id === id);

        if (index === -1) {
            return { success: false, message: 'Maintenance window not found' };
        }

        const oldStatus = windows[index].status;
        windows[index].status = status;
        windows[index].statusNotes = notes;
        windows[index].statusUpdatedAt = new Date().toISOString();

        if (status === 'completed') {
            windows[index].completedAt = new Date().toISOString();
        }

        DB.set(DB.KEYS.MAINTENANCE_WINDOWS, windows);

        AuditLog.log('update', 'maintenance', id,
            `Changed status from ${oldStatus} to ${status}`, { status: oldStatus }, { status });

        return { success: true };
    },

    delete(id) {
        const windows = DB.get(DB.KEYS.MAINTENANCE_WINDOWS);
        const window = windows.find(mw => mw.id === id);

        if (!window) {
            return { success: false, message: 'Maintenance window not found' };
        }

        const filtered = windows.filter(mw => mw.id !== id);
        DB.set(DB.KEYS.MAINTENANCE_WINDOWS, filtered);

        AuditLog.log('delete', 'maintenance', id,
            `Deleted maintenance window: ${window.title}`, window, null);

        return { success: true };
    },

    getCalendarEvents(startDate, endDate) {
        const all = this.getAll();
        return all.filter(mw => {
            const start = new Date(mw.startTime);
            const end = new Date(mw.endTime);
            return start <= endDate && end >= startDate;
        }).map(mw => ({
            id: mw.id,
            title: mw.title,
            start: mw.startTime,
            end: mw.endTime,
            type: mw.type,
            status: mw.status,
            color: MAINTENANCE_TYPES.find(t => t.id === mw.type)?.color || '#3b82f6'
        }));
    }
};

// ============================================
// Hardware Lifecycle Management
// ============================================

const HardwareLifecycle = {
    getStatus(host) {
        if (!host.purchaseDate && !host.warrantyExpiry && !host.eolDate) {
            return null;
        }

        const now = new Date();
        const warrantyExpiry = host.warrantyExpiry ? new Date(host.warrantyExpiry) : null;
        const eolDate = host.eolDate ? new Date(host.eolDate) : null;

        // Check decommissioned first
        if (host.lifecycleStatus === 'decommissioned') {
            return LIFECYCLE_STATUS.find(s => s.id === 'decommissioned');
        }

        // Check EOL
        if (eolDate && now >= eolDate) {
            return LIFECYCLE_STATUS.find(s => s.id === 'eol');
        }

        // Check EOL announced (within 6 months)
        if (eolDate) {
            const sixMonthsBefore = new Date(eolDate);
            sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
            if (now >= sixMonthsBefore) {
                return LIFECYCLE_STATUS.find(s => s.id === 'eol_announced');
            }
        }

        // Check warranty
        if (warrantyExpiry) {
            if (now > warrantyExpiry) {
                return LIFECYCLE_STATUS.find(s => s.id === 'out_of_warranty');
            }

            // Check if expiring within 30 days
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            if (warrantyExpiry <= thirtyDaysFromNow) {
                return LIFECYCLE_STATUS.find(s => s.id === 'expiring');
            }

            return LIFECYCLE_STATUS.find(s => s.id === 'warranty');
        }

        return LIFECYCLE_STATUS.find(s => s.id === 'active');
    },

    getHostsNeedingAttention() {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const attention = [];

        hosts.forEach(host => {
            const status = this.getStatus(host);
            if (status && ['expiring', 'out_of_warranty', 'eol_announced', 'eol'].includes(status.id)) {
                attention.push({
                    ...host,
                    lifecycleAlert: status
                });
            }
        });

        return attention;
    },

    getWarrantyExpiringSoon(days = 30) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + days);

        return hosts.filter(host => {
            if (!host.warrantyExpiry) return false;
            const expiry = new Date(host.warrantyExpiry);
            return expiry > new Date() && expiry <= cutoff;
        });
    },

    getEOLSoon(days = 180) {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + days);

        return hosts.filter(host => {
            if (!host.eolDate) return false;
            const eol = new Date(host.eolDate);
            return eol > new Date() && eol <= cutoff;
        });
    },

    calculateAge(purchaseDate) {
        if (!purchaseDate) return null;
        const purchase = new Date(purchaseDate);
        const now = new Date();
        const years = (now - purchase) / (365.25 * 24 * 60 * 60 * 1000);
        return Math.round(years * 10) / 10; // Round to 1 decimal
    },

    getDaysUntilWarrantyExpiry(warrantyExpiry) {
        if (!warrantyExpiry) return null;
        const expiry = new Date(warrantyExpiry);
        const now = new Date();
        return Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
    },

    getDaysUntilEOL(eolDate) {
        if (!eolDate) return null;
        const eol = new Date(eolDate);
        const now = new Date();
        return Math.ceil((eol - now) / (24 * 60 * 60 * 1000));
    },

    getSummary() {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const summary = {
            total: hosts.length,
            withLifecycleData: 0,
            underWarranty: 0,
            warrantyExpiringSoon: 0,
            outOfWarranty: 0,
            eolAnnounced: 0,
            eol: 0,
            averageAge: 0
        };

        let totalAge = 0;
        let ageCount = 0;

        hosts.forEach(host => {
            if (host.purchaseDate || host.warrantyExpiry || host.eolDate) {
                summary.withLifecycleData++;
            }

            const status = this.getStatus(host);
            if (status) {
                switch (status.id) {
                    case 'warranty':
                        summary.underWarranty++;
                        break;
                    case 'expiring':
                        summary.warrantyExpiringSoon++;
                        break;
                    case 'out_of_warranty':
                        summary.outOfWarranty++;
                        break;
                    case 'eol_announced':
                        summary.eolAnnounced++;
                        break;
                    case 'eol':
                        summary.eol++;
                        break;
                }
            }

            const age = this.calculateAge(host.purchaseDate);
            if (age !== null) {
                totalAge += age;
                ageCount++;
            }
        });

        summary.averageAge = ageCount > 0 ? Math.round(totalAge / ageCount * 10) / 10 : 0;

        return summary;
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

        // Record IP history
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

        // Record IP history
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

// ============================================
// Host Management (CMDB)
// ============================================

// Host Types Configuration
const HOST_TYPES = [
    { id: 'virtual_machine', name: 'Virtual Machine', icon: '💻', color: '#3b82f6' },
    { id: 'physical_server', name: 'Physical Server', icon: '🖥️', color: '#6366f1' },
    { id: 'firewall', name: 'Firewall', icon: '🛡️', color: '#ef4444' },
    { id: 'load_balancer', name: 'Load Balancer', icon: '⚖️', color: '#8b5cf6' },
    { id: 'router', name: 'Router', icon: '🔀', color: '#06b6d4' },
    { id: 'switch', name: 'Switch', icon: '🔌', color: '#14b8a6' },
    { id: 'storage', name: 'Storage', icon: '💾', color: '#f59e0b' },
    { id: 'test_machine', name: 'Test Machine', icon: '🧪', color: '#10b981' },
    { id: 'airco', name: 'Air Conditioning', icon: '❄️', color: '#0ea5e9' },
    { id: 'ups', name: 'UPS', icon: '🔋', color: '#eab308' },
    { id: 'pdu', name: 'PDU', icon: '🔌', color: '#a855f7' },
    { id: 'printer', name: 'Printer', icon: '🖨️', color: '#64748b' },
    { id: 'camera', name: 'Camera/NVR', icon: '📷', color: '#475569' },
    { id: 'other', name: 'Other', icon: '📦', color: '#6b7280' }
];

const HostManager = {
    getAll() {
        const hosts = DB.get(DB.KEYS.HOSTS);
        const ips = DB.get(DB.KEYS.IPS);
        const companies = DB.get(DB.KEYS.COMPANIES);

        return hosts.map(host => {
            const hostIPs = ips.filter(ip => ip.hostId === host.id);
            const company = companies.find(c => c.id === host.companyId);
            const hostType = HOST_TYPES.find(t => t.id === host.hostType) || HOST_TYPES.find(t => t.id === 'virtual_machine');
            return {
                ...host,
                ipAddresses: hostIPs.map(ip => ip.ipAddress).join(', '),
                companyName: company ? company.name : 'Unassigned',
                companyColor: company ? company.color : '#6b7280',
                hostTypeName: hostType.name,
                hostTypeIcon: hostType.icon,
                hostTypeColor: hostType.color
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
        const hostType = HOST_TYPES.find(t => t.id === host.hostType) || HOST_TYPES.find(t => t.id === 'virtual_machine');

        return {
            ...host,
            ipAddresses: hostIPs.map(ip => ip.ipAddress).join(', '),
            companyName: company ? company.name : 'Unassigned',
            companyColor: company ? company.color : '#6b7280',
            hostTypeName: hostType.name,
            hostTypeIcon: hostType.icon,
            hostTypeColor: hostType.color
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
            hostType: data.hostType || 'virtual_machine',
            description: data.description || '',
            serialNumber: data.serialNumber || '',
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
            // Hardware Lifecycle fields
            purchaseDate: data.purchaseDate || null,
            warrantyExpiry: data.warrantyExpiry || null,
            eolDate: data.eolDate || null,
            lifecycleStatus: data.lifecycleStatus || 'active',
            vendor: data.vendor || '',
            model: data.model || '',
            assetTag: data.assetTag || '',
            location: data.location || '',
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

// UI Settings
let compactView = localStorage.getItem('ipdb_compactView') === 'true';
let hostColumnSettings = JSON.parse(localStorage.getItem('ipdb_hostColumns') || 'null') || {
    checkbox: true,
    vmName: true,
    hostType: true,
    company: true,
    os: true,
    state: true,
    node: true,
    resources: true,
    ipAddresses: true,
    serialNumber: false,
    description: false,
    actions: true
};

function saveUISettings() {
    localStorage.setItem('ipdb_compactView', compactView);
    localStorage.setItem('ipdb_hostColumns', JSON.stringify(hostColumnSettings));
}

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

    const table = document.getElementById('hostsTable');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    // Apply compact view class
    table.classList.toggle('compact', compactView);

    // Build header with column visibility
    let headerHtml = '';
    if (hostColumnSettings.checkbox) headerHtml += '<th class="checkbox-col"><input type="checkbox" id="selectAllHosts" onchange="toggleAllHosts(this)"></th>';
    if (hostColumnSettings.vmName) headerHtml += '<th class="sortable" data-sort="vm_name">Name</th>';
    if (hostColumnSettings.hostType) headerHtml += '<th class="sortable" data-sort="host_type">Type</th>';
    if (hostColumnSettings.company) headerHtml += '<th>Company</th>';
    if (hostColumnSettings.os) headerHtml += '<th class="sortable" data-sort="operating_system">OS</th>';
    if (hostColumnSettings.state) headerHtml += '<th class="sortable" data-sort="state">State</th>';
    if (hostColumnSettings.node) headerHtml += '<th class="sortable" data-sort="node">Node</th>';
    if (hostColumnSettings.resources) headerHtml += '<th>Resources</th>';
    if (hostColumnSettings.ipAddresses) headerHtml += '<th>IP Addresses</th>';
    if (hostColumnSettings.serialNumber) headerHtml += '<th>Serial Number</th>';
    if (hostColumnSettings.description) headerHtml += '<th>Description</th>';
    if (hostColumnSettings.actions) headerHtml += '<th>Actions</th>';
    thead.innerHTML = headerHtml;

    // Reattach sort event listeners
    thead.querySelectorAll('.sortable').forEach(th => {
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

    const colCount = Object.values(hostColumnSettings).filter(v => v).length;

    if (hosts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-message">No hosts found</td></tr>`;
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

        let rowHtml = `<tr data-id="${host.id}" data-company="${host.companyId || ''}" data-state="${host.state?.toLowerCase()}" data-type="${host.hostType || ''}" data-ips="${host.ipAddresses}" class="${isSelected ? 'selected' : ''}">`;

        if (hostColumnSettings.checkbox) {
            rowHtml += `<td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleHostSelection('${host.id}', this)"></td>`;
        }
        if (hostColumnSettings.vmName) {
            rowHtml += `<td><strong>${escapeHtml(host.vmName)}</strong>${host.favorite ? ' ⭐' : ''}</td>`;
        }
        if (hostColumnSettings.hostType) {
            rowHtml += `<td>
                <span class="host-type-badge" style="background: ${host.hostTypeColor}15; color: ${host.hostTypeColor}">
                    <span class="host-type-icon">${host.hostTypeIcon}</span>
                    <span class="host-type-name">${escapeHtml(host.hostTypeName)}</span>
                </span>
            </td>`;
        }
        if (hostColumnSettings.company) {
            rowHtml += `<td>
                <span class="company-badge" style="background: ${host.companyColor}15; color: ${host.companyColor}">
                    <span class="company-badge-dot" style="background: ${host.companyColor}"></span>
                    ${escapeHtml(host.companyName)}
                </span>
            </td>`;
        }
        if (hostColumnSettings.os) {
            rowHtml += `<td>${escapeHtml(host.operatingSystem || '-')}</td>`;
        }
        if (hostColumnSettings.state) {
            rowHtml += `<td><span class="status-badge ${host.state?.toLowerCase()}">${host.state || '-'}</span></td>`;
        }
        if (hostColumnSettings.node) {
            rowHtml += `<td>${escapeHtml(host.node || '-')}</td>`;
        }
        if (hostColumnSettings.resources) {
            rowHtml += `<td class="resource-display"><span>${resources.join(' • ') || '-'}</span></td>`;
        }
        if (hostColumnSettings.ipAddresses) {
            rowHtml += `<td style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(host.ipAddresses || '-')}</td>`;
        }
        if (hostColumnSettings.serialNumber) {
            rowHtml += `<td style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(host.serialNumber || '-')}</td>`;
        }
        if (hostColumnSettings.description) {
            rowHtml += `<td class="description-cell">${escapeHtml(host.description || '-')}</td>`;
        }
        if (hostColumnSettings.actions) {
            rowHtml += `<td>
                <div class="action-btns">
                    <button class="btn-icon view" onclick="viewHost('${host.id}')" title="View">👁</button>
                    <button class="btn-icon edit" onclick="editHost('${host.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteHost('${host.id}')" title="Delete">🗑️</button>
                </div>
            </td>`;
        }

        rowHtml += '</tr>';
        return rowHtml;
    }).join('');

    updateBulkEditHostsButton();
}

// Toggle compact view
function toggleCompactView() {
    compactView = !compactView;
    saveUISettings();
    refreshHostsTable();
    refreshIPsTable();
    refreshSubnetsTable();

    const btn = document.getElementById('compactViewBtn');
    if (btn) {
        btn.classList.toggle('active', compactView);
    }
}

// Show column settings modal
function showColumnSettingsModal() {
    const content = document.getElementById('columnSettingsContent');
    const columns = [
        { key: 'checkbox', label: 'Selection Checkbox' },
        { key: 'vmName', label: 'Host Name' },
        { key: 'hostType', label: 'Host Type' },
        { key: 'company', label: 'Company' },
        { key: 'os', label: 'Operating System' },
        { key: 'state', label: 'State' },
        { key: 'node', label: 'Node' },
        { key: 'resources', label: 'Resources' },
        { key: 'ipAddresses', label: 'IP Addresses' },
        { key: 'serialNumber', label: 'Serial Number' },
        { key: 'description', label: 'Description' },
        { key: 'actions', label: 'Actions' }
    ];

    content.innerHTML = columns.map(col => `
        <label class="column-toggle">
            <input type="checkbox" ${hostColumnSettings[col.key] ? 'checked' : ''}
                   onchange="toggleColumn('${col.key}', this.checked)">
            <span class="column-toggle-label">${col.label}</span>
        </label>
    `).join('');

    openModal('columnSettingsModal');
}

// Toggle column visibility
function toggleColumn(columnKey, visible) {
    hostColumnSettings[columnKey] = visible;
    saveUISettings();
    refreshHostsTable();
}

function filterHosts() {
    const search = document.getElementById('hostSearchInput').value.toLowerCase();
    const companyFilter = document.getElementById('hostCompanyFilter').value;
    const stateFilter = document.getElementById('hostStateFilter').value.toLowerCase();
    const subnetFilter = document.getElementById('hostSubnetFilter').value;
    const typeFilter = document.getElementById('hostTypeFilter')?.value || '';

    const rows = document.querySelectorAll('#hostsTable tbody tr[data-id]');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const company = row.dataset.company;
        const state = row.dataset.state;
        const type = row.dataset.type;
        const ips = row.dataset.ips || '';

        let visible = true;

        if (search && !text.includes(search)) visible = false;
        if (companyFilter && company !== companyFilter) visible = false;
        if (stateFilter && state !== stateFilter) visible = false;
        if (typeFilter && type !== typeFilter) visible = false;

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
    populateHostTypeSelect('hostType');

    document.querySelector('input[name="ipMethod"][value="auto"]').checked = true;
    toggleIPAssignment();

    document.querySelector('#addHostModal .modal-header h3').textContent = 'Add Host';
    openModal('addHostModal');
}

// Populate host type select dropdown
function populateHostTypeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = HOST_TYPES.map(type =>
        `<option value="${type.id}">${type.icon} ${type.name}</option>`
    ).join('');
}

// Populate host type filter dropdown
function populateHostTypeFilter() {
    const select = document.getElementById('hostTypeFilter');
    if (!select) return;

    select.innerHTML = '<option value="">All Types</option>' +
        HOST_TYPES.map(type =>
            `<option value="${type.id}">${type.icon} ${type.name}</option>`
        ).join('');
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
    populateHostTypeSelect('hostType');

    document.getElementById('hostCompany').value = host.companyId || '';
    document.getElementById('hostVMName').value = host.vmName || '';
    document.getElementById('hostType').value = host.hostType || 'virtual_machine';
    document.getElementById('hostDescription').value = host.description || '';
    document.getElementById('hostSerialNumber').value = host.serialNumber || '';
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
        hostType: document.getElementById('hostType').value || 'virtual_machine',
        description: document.getElementById('hostDescription').value,
        serialNumber: document.getElementById('hostSerialNumber').value,
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
                <label>Host Name</label>
                <div class="value">${escapeHtml(host.vmName)} ${host.favorite ? '⭐' : ''}</div>
            </div>
            <div class="detail-item">
                <label>Host Type</label>
                <div class="value">
                    <span class="host-type-badge" style="background: ${host.hostTypeColor}15; color: ${host.hostTypeColor}">
                        <span class="host-type-icon">${host.hostTypeIcon}</span>
                        <span class="host-type-name">${escapeHtml(host.hostTypeName)}</span>
                    </span>
                </div>
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
                <label>Serial Number</label>
                <div class="value" style="font-family: monospace;">${escapeHtml(host.serialNumber || '-')}</div>
            </div>
            <div class="detail-item full-width">
                <label>Description</label>
                <div class="value">${escapeHtml(host.description || '-')}</div>
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
        tbody.innerHTML = '<tr><td colspan="9" class="empty-message">No IP addresses tracked</td></tr>';
        selectedIPs.clear();
        updateBulkEditIPsButton();
        return;
    }

    tbody.innerHTML = ips.map(ip => {
        const isSelected = selectedIPs.has(ip.ipAddress);

        // Build assigned to / reserved for cell
        let assignedCell = '-';
        if (ip.status === 'assigned' && ip.hostName) {
            assignedCell = escapeHtml(ip.hostName);
        } else if (ip.status === 'reserved') {
            if (ip.reservationTypeName) {
                assignedCell = `<span class="reservation-badge" style="background: ${ip.reservationTypeColor}15; color: ${ip.reservationTypeColor}">
                    ${ip.reservationTypeIcon || '📌'} ${ip.reservationTypeName}
                </span>`;
                if (ip.reservationDescription) {
                    assignedCell += `<br><small class="text-muted">${escapeHtml(ip.reservationDescription)}</small>`;
                }
            } else {
                assignedCell = '<span class="text-muted">Reserved</span>';
            }
        }

        return `
        <tr data-ip="${ip.ipAddress}" data-subnet="${ip.subnetId || ''}" data-company="${ip.companyId || ''}" data-status="${ip.status}" class="${isSelected ? 'selected' : ''}">
            <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleIPSelection('${ip.ipAddress}', this)"></td>
            <td><strong style="font-family: monospace;">${ip.ipAddress}</strong></td>
            <td style="font-family: monospace; font-size: 0.85em; color: var(--text-secondary);">${escapeHtml(ip.dnsName || '-')}</td>
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
            <td>${assignedCell}</td>
            <td>${ip.updatedAt ? new Date(ip.updatedAt).toLocaleDateString() : '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="showEditIPModal('${ip.ipAddress}')" title="Edit">✏️</button>
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

let ipamCompactView = false;

function toggleIPAMCompactView() {
    ipamCompactView = !ipamCompactView;
    const table = document.getElementById('ipsTable');
    const btn = document.getElementById('ipamCompactViewBtn');

    if (table) {
        table.classList.toggle('compact-table', ipamCompactView);
    }

    if (btn) {
        btn.classList.toggle('active', ipamCompactView);
    }

    // Save preference
    Settings.set('ipamCompactView', ipamCompactView);
}

function initIPAMCompactView() {
    ipamCompactView = Settings.get('ipamCompactView') || false;
    const table = document.getElementById('ipsTable');
    const btn = document.getElementById('ipamCompactViewBtn');

    if (table && ipamCompactView) {
        table.classList.add('compact-table');
    }

    if (btn && ipamCompactView) {
        btn.classList.add('active');
    }
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
        version: 4,
        timestamp: new Date().toISOString(),
        companies: DB.get(DB.KEYS.COMPANIES),
        subnets: DB.get(DB.KEYS.SUBNETS),
        hosts: DB.get(DB.KEYS.HOSTS),
        ips: DB.get(DB.KEYS.IPS),
        vlans: DB.get(DB.KEYS.VLANS),
        ipRanges: DB.get(DB.KEYS.IP_RANGES),
        subnetTemplates: DB.get(DB.KEYS.SUBNET_TEMPLATES),
        reservations: DB.get(DB.KEYS.RESERVATIONS),
        ipHistory: DB.get(DB.KEYS.IP_HISTORY),
        maintenanceWindows: DB.get(DB.KEYS.MAINTENANCE_WINDOWS),
        auditLog: DB.get(DB.KEYS.AUDIT_LOG),
        settings: localStorage.getItem(DB.KEYS.SETTINGS) ? JSON.parse(localStorage.getItem(DB.KEYS.SETTINGS)) : {}
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
            DB.set(DB.KEYS.VLANS, backup.vlans || []);
            DB.set(DB.KEYS.IP_RANGES, backup.ipRanges || []);
            DB.set(DB.KEYS.SUBNET_TEMPLATES, backup.subnetTemplates || []);
            DB.set(DB.KEYS.RESERVATIONS, backup.reservations || []);
            DB.set(DB.KEYS.IP_HISTORY, backup.ipHistory || []);
            DB.set(DB.KEYS.MAINTENANCE_WINDOWS, backup.maintenanceWindows || []);
            DB.set(DB.KEYS.AUDIT_LOG, backup.auditLog || []);
            if (backup.settings) {
                localStorage.setItem(DB.KEYS.SETTINGS, JSON.stringify(backup.settings));
            }

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
    populateHostTypeFilter();

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
        'node': 'node',
        'host_type': 'hostType'
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

    // Populate host type select
    const hostTypeSelect = document.getElementById('bulkHostType');
    hostTypeSelect.innerHTML = '<option value="">-- No Change --</option>' +
        HOST_TYPES.map(type => `<option value="${type.id}">${type.icon} ${type.name}</option>`).join('');

    openModal('bulkEditHostsModal');
}

function saveBulkEditHosts(e) {
    e.preventDefault();

    const companyId = document.getElementById('bulkHostCompany').value;
    const hostType = document.getElementById('bulkHostType').value;
    const state = document.getElementById('bulkHostState').value;
    const node = document.getElementById('bulkHostNode').value.trim();
    const os = document.getElementById('bulkHostOS').value.trim();

    // Check if any changes to apply
    if (!companyId && !hostType && !state && !node && !os) {
        showToast('No changes specified', 'error');
        return;
    }

    let updateCount = 0;

    selectedHosts.forEach(hostId => {
        const updates = {};

        if (companyId) updates.companyId = companyId;
        if (hostType) updates.hostType = hostType;
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
// VLAN UI Functions
// ============================================

function refreshVLANsTable() {
    const vlans = VLANManager.getAll();
    const tbody = document.getElementById('vlansTable')?.querySelector('tbody');

    if (!tbody) return;

    if (vlans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">No VLANs configured</td></tr>';
        return;
    }

    tbody.innerHTML = vlans.map(vlan => `
        <tr>
            <td><strong>${vlan.vlanId}</strong></td>
            <td>${escapeHtml(vlan.name)}</td>
            <td>
                <span class="status-badge" style="background: ${vlan.typeColor}15; color: ${vlan.typeColor}">
                    ${vlan.typeName}
                </span>
            </td>
            <td>
                <span class="company-badge" style="background: ${vlan.companyColor}15; color: ${vlan.companyColor}">
                    <span class="company-badge-dot" style="background: ${vlan.companyColor}"></span>
                    ${escapeHtml(vlan.companyName)}
                </span>
            </td>
            <td>${vlan.subnetCount} subnets</td>
            <td>${escapeHtml(vlan.description || '-')}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editVLAN('${vlan.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteVLAN('${vlan.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function showAddVLANModal() {
    document.getElementById('vlanForm').reset();
    document.getElementById('vlanEditId').value = '';
    populateCompanySelect('vlanCompany');
    populateVLANTypeSelect('vlanType');
    document.querySelector('#addVLANModal .modal-header h3').textContent = 'Add VLAN';
    openModal('addVLANModal');
}

function populateVLANTypeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = VLAN_TYPES.map(type =>
        `<option value="${type.id}">${type.name}</option>`
    ).join('');
}

function editVLAN(id) {
    const vlan = VLANManager.getById(id);
    if (!vlan) return;

    populateCompanySelect('vlanCompany');
    populateVLANTypeSelect('vlanType');

    document.getElementById('vlanId').value = vlan.vlanId;
    document.getElementById('vlanName').value = vlan.name || '';
    document.getElementById('vlanType').value = vlan.type || 'data';
    document.getElementById('vlanCompany').value = vlan.companyId || '';
    document.getElementById('vlanDescription').value = vlan.description || '';
    document.getElementById('vlanEditId').value = id;

    document.querySelector('#addVLANModal .modal-header h3').textContent = 'Edit VLAN';
    openModal('addVLANModal');
}

function saveVLAN(e) {
    e.preventDefault();

    const id = document.getElementById('vlanEditId').value;
    const data = {
        vlanId: document.getElementById('vlanId').value,
        name: document.getElementById('vlanName').value,
        type: document.getElementById('vlanType').value,
        companyId: document.getElementById('vlanCompany').value || null,
        description: document.getElementById('vlanDescription').value
    };

    let result;
    if (id) {
        result = VLANManager.update(id, data);
    } else {
        result = VLANManager.add(data);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshVLANsTable();
        refreshDashboard();
    } else {
        showToast(result.message, 'error');
    }
}

function deleteVLAN(id) {
    const vlan = VLANManager.getById(id);
    if (!vlan) return;

    if (!confirm(`Delete VLAN ${vlan.vlanId} (${vlan.name})?`)) return;

    const result = VLANManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshVLANsTable();
    } else {
        showToast(result.message, 'error');
    }
}

// ============================================
// IP Range UI Functions
// ============================================

function refreshIPRangesTable() {
    const ranges = IPRangeManager.getAll();
    const tbody = document.getElementById('ipRangesTable')?.querySelector('tbody');

    if (!tbody) return;

    if (ranges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No IP ranges configured</td></tr>';
        return;
    }

    tbody.innerHTML = ranges.map(range => {
        const usage = range.totalIPs > 0 ? Math.round((range.usedIPs / range.totalIPs) * 100) : 0;
        const barClass = usage >= 90 ? 'high' : usage >= 70 ? 'medium' : 'low';

        return `
        <tr data-subnet="${range.subnetId}">
            <td>
                <span style="background: ${range.purposeColor}15; color: ${range.purposeColor}; padding: 4px 8px; border-radius: 4px;">
                    ${range.purposeIcon} ${range.purposeName}
                </span>
            </td>
            <td>${escapeHtml(range.name || '-')}</td>
            <td style="font-family: monospace;">${range.subnetName}</td>
            <td style="font-family: monospace;">${range.startIP}</td>
            <td style="font-family: monospace;">${range.endIP}</td>
            <td>${range.totalIPs} IPs</td>
            <td>
                <div class="usage-bar-container">
                    <div class="usage-bar">
                        <div class="usage-bar-fill ${barClass}" style="width: ${usage}%"></div>
                    </div>
                    <span class="usage-text">${range.usedIPs}/${range.totalIPs}</span>
                </div>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon edit" onclick="editIPRange('${range.id}')" title="Edit">✏️</button>
                    <button class="btn-icon delete" onclick="deleteIPRange('${range.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function showAddIPRangeModal() {
    document.getElementById('ipRangeForm').reset();
    document.getElementById('ipRangeEditId').value = '';
    populateSubnetSelect('ipRangeSubnet');
    populateRangePurposeSelect('ipRangePurpose');
    document.querySelector('#addIPRangeModal .modal-header h3').textContent = 'Add IP Range';
    openModal('addIPRangeModal');
}

function populateSubnetSelect(selectId) {
    const subnets = SubnetManager.getAll();
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Subnet --</option>' +
        subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr}${s.name ? ` (${s.name})` : ''}</option>`).join('');
}

function populateRangePurposeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = RANGE_PURPOSES.map(p =>
        `<option value="${p.id}">${p.icon} ${p.name}</option>`
    ).join('');
}

function editIPRange(id) {
    const range = IPRangeManager.getById(id);
    if (!range) return;

    populateSubnetSelect('ipRangeSubnet');
    populateRangePurposeSelect('ipRangePurpose');

    document.getElementById('ipRangeSubnet').value = range.subnetId || '';
    document.getElementById('ipRangeStartIP').value = range.startIP;
    document.getElementById('ipRangeEndIP').value = range.endIP;
    document.getElementById('ipRangePurpose').value = range.purpose || 'other';
    document.getElementById('ipRangeName').value = range.name || '';
    document.getElementById('ipRangeDescription').value = range.description || '';
    document.getElementById('ipRangeEditId').value = id;

    document.querySelector('#addIPRangeModal .modal-header h3').textContent = 'Edit IP Range';
    openModal('addIPRangeModal');
}

function saveIPRange(e) {
    e.preventDefault();

    const id = document.getElementById('ipRangeEditId').value;
    const data = {
        subnetId: document.getElementById('ipRangeSubnet').value,
        startIP: document.getElementById('ipRangeStartIP').value,
        endIP: document.getElementById('ipRangeEndIP').value,
        purpose: document.getElementById('ipRangePurpose').value,
        name: document.getElementById('ipRangeName').value,
        description: document.getElementById('ipRangeDescription').value
    };

    let result;
    if (id) {
        result = IPRangeManager.update(id, data);
    } else {
        result = IPRangeManager.add(data);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshIPRangesTable();
    } else {
        showToast(result.message, 'error');
    }
}

function deleteIPRange(id) {
    if (!confirm('Delete this IP range?')) return;

    const result = IPRangeManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshIPRangesTable();
    } else {
        showToast(result.message, 'error');
    }
}

// ============================================
// Subnet Templates UI Functions
// ============================================

function refreshTemplatesGrid() {
    const templates = SubnetTemplateManager.getAll();
    const grid = document.getElementById('templatesGrid');

    if (!grid) return;

    grid.innerHTML = templates.map(template => {
        const vlanType = VLAN_TYPES.find(t => t.id === template.vlanType) || VLAN_TYPES[0];
        return `
        <div class="template-card" onclick="viewTemplate('${template.id}')">
            <div class="template-card-header" style="background: ${vlanType.color}">
                <h4>${escapeHtml(template.name)}</h4>
                ${template.isCustom ? '<span class="template-badge">Custom</span>' : ''}
            </div>
            <div class="template-card-body">
                <p>${escapeHtml(template.description)}</p>
                <div class="template-stats">
                    <span>/${template.cidr} CIDR</span>
                    <span>${template.ranges?.length || 0} ranges</span>
                    <span>${template.reservations?.length || 0} reservations</span>
                </div>
            </div>
            <div class="template-card-actions">
                <button class="btn-secondary" onclick="event.stopPropagation(); applyTemplateToSubnet('${template.id}')">Apply to Subnet</button>
                ${template.isCustom ? `<button class="btn-icon delete" onclick="event.stopPropagation(); deleteTemplate('${template.id}')" title="Delete">🗑️</button>` : ''}
            </div>
        </div>
    `}).join('');
}

function viewTemplate(templateId) {
    const template = SubnetTemplateManager.getById(templateId);
    if (!template) return;

    const vlanType = VLAN_TYPES.find(t => t.id === template.vlanType) || VLAN_TYPES[0];

    const content = document.getElementById('templateDetailsContent');
    content.innerHTML = `
        <div class="template-detail-header" style="background: ${vlanType.color}20; border-left: 4px solid ${vlanType.color};">
            <h4>${escapeHtml(template.name)}</h4>
            <p>${escapeHtml(template.description)}</p>
            <div class="template-meta">
                <span>CIDR: /${template.cidr}</span>
                <span>VLAN Type: ${vlanType.name}</span>
            </div>
        </div>

        <h5 style="margin: 20px 0 12px;">IP Ranges</h5>
        <div class="template-ranges">
            ${template.ranges?.map(range => {
                const purpose = RANGE_PURPOSES.find(p => p.id === range.purpose) || RANGE_PURPOSES[10];
                return `
                <div class="template-range-item" style="border-left: 4px solid ${purpose.color};">
                    <span class="range-purpose">${purpose.icon} ${range.name || purpose.name}</span>
                    <span class="range-offsets">.${range.startOffset} - .${range.endOffset}</span>
                </div>
            `}).join('') || '<p class="empty-state">No ranges defined</p>'}
        </div>

        <h5 style="margin: 20px 0 12px;">Reserved IPs</h5>
        <div class="template-reservations">
            ${template.reservations?.map(res => {
                const type = RESERVATION_TYPES.find(t => t.id === res.type) || RESERVATION_TYPES[8];
                return `
                <div class="template-reservation-item">
                    <span>${type.icon} .${res.offset}</span>
                    <span>${res.description}</span>
                </div>
            `}).join('') || '<p class="empty-state">No reservations defined</p>'}
        </div>
    `;

    openModal('viewTemplateModal');
}

function applyTemplateToSubnet(templateId) {
    const subnets = SubnetManager.getAll();

    if (subnets.length === 0) {
        showToast('No subnets available. Create a subnet first.', 'error');
        return;
    }

    const template = SubnetTemplateManager.getById(templateId);

    // Show subnet selection modal
    const content = document.getElementById('applyTemplateContent');
    content.innerHTML = `
        <p>Select a subnet to apply the "${escapeHtml(template.name)}" template to:</p>
        <div class="form-group">
            <label>Subnet *</label>
            <select id="applyTemplateSubnet" required>
                <option value="">-- Select Subnet --</option>
                ${subnets.map(s => `<option value="${s.id}">${s.network}/${s.cidr}${s.name ? ` (${s.name})` : ''}</option>`).join('')}
            </select>
        </div>
        <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="button" class="btn-primary" onclick="confirmApplyTemplate('${templateId}')">Apply Template</button>
        </div>
    `;

    openModal('applyTemplateModal');
}

function confirmApplyTemplate(templateId) {
    const subnetId = document.getElementById('applyTemplateSubnet').value;
    if (!subnetId) {
        showToast('Please select a subnet', 'error');
        return;
    }

    const result = SubnetTemplateManager.applyTemplate(templateId, subnetId);
    if (result.success) {
        showToast(result.message, 'success');
        closeModal();
        refreshIPRangesTable();
        refreshIPsTable();
    } else {
        showToast(result.message, 'error');
    }
}

function deleteTemplate(id) {
    if (!confirm('Delete this custom template?')) return;

    const result = SubnetTemplateManager.delete(id);
    if (result.success) {
        showToast(result.message, 'success');
        refreshTemplatesGrid();
    } else {
        showToast(result.message, 'error');
    }
}

// ============================================
// IP Reservations UI Functions
// ============================================

function showAddReservationModal() {
    document.getElementById('reservationForm').reset();
    populateReservationTypeSelect('reservationType');
    document.querySelector('#addReservationModal .modal-header h3').textContent = 'Reserve IP Address';
    openModal('addReservationModal');
}

function populateReservationTypeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = RESERVATION_TYPES.map(type =>
        `<option value="${type.id}">${type.icon} ${type.name}</option>`
    ).join('');
}

function saveReservation(e) {
    e.preventDefault();

    const ipAddress = document.getElementById('reservationIP').value;
    const reservationType = document.getElementById('reservationType').value;
    const description = document.getElementById('reservationDescription').value;
    const dnsName = document.getElementById('reservationDNS').value;

    if (!IPUtils.isValidIP(ipAddress)) {
        showToast('Invalid IP address', 'error');
        return;
    }

    // Check for conflicts
    const conflict = ConflictDetector.checkIPConflict(ipAddress);
    if (conflict.hasConflict) {
        showToast(conflict.message, 'error');
        return;
    }

    // Update IP with reservation info
    const result = IPManager.updateStatus(ipAddress, 'reserved', null);
    if (result.success) {
        const ips = DB.get(DB.KEYS.IPS);
        const ipRecord = ips.find(i => i.ipAddress === ipAddress);
        if (ipRecord) {
            ipRecord.reservationType = reservationType;
            ipRecord.reservationDescription = description;
            ipRecord.dnsName = dnsName;
            DB.set(DB.KEYS.IPS, ips);
        }
        showToast('IP reserved successfully', 'success');
        closeModal();
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast('Failed to reserve IP', 'error');
    }
}

// ============================================
// IP Conflict Detection UI Functions
// ============================================

function refreshConflictsPanel() {
    const conflicts = ConflictDetector.checkForConflicts();
    const panel = document.getElementById('conflictsPanel');
    const badge = document.getElementById('conflictsBadge');

    if (!panel) return;

    if (badge) {
        if (conflicts.length > 0) {
            badge.textContent = conflicts.length;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    if (conflicts.length === 0) {
        panel.innerHTML = `
            <div class="no-conflicts-compact">
                <span class="success-badge">✓ No Conflicts</span>
                <span class="success-text">All IP addresses properly configured</span>
            </div>
        `;
        return;
    }

    panel.innerHTML = `
        <div class="conflicts-header">
            <span class="conflicts-count">${conflicts.length} issue${conflicts.length !== 1 ? 's' : ''} found</span>
        </div>
        <div class="conflicts-list">
            ${conflicts.map(conflict => `
                <div class="conflict-item ${conflict.severity}">
                    <div class="conflict-icon">${conflict.severity === 'high' ? '🔴' : '🟡'}</div>
                    <div class="conflict-details">
                        <span class="conflict-ip" style="font-family: monospace; font-weight: 600;">${conflict.ipAddress}</span>
                        <p class="conflict-message">${conflict.message}</p>
                        ${conflict.hosts ? `<span class="conflict-hosts">Hosts: ${conflict.hosts.join(', ')}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// DNS Integration UI Functions
// ============================================

function updateIPDNS(ipAddress, dnsName) {
    const ips = DB.get(DB.KEYS.IPS);
    const ipRecord = ips.find(i => i.ipAddress === ipAddress);

    if (ipRecord) {
        ipRecord.dnsName = dnsName;
        ipRecord.updatedAt = new Date().toISOString();
        DB.set(DB.KEYS.IPS, ips);
        return { success: true, message: 'DNS name updated' };
    }

    return { success: false, message: 'IP not found' };
}

function showEditIPModal(ipAddress) {
    const ips = IPManager.getAll();
    const ip = ips.find(i => i.ipAddress === ipAddress);

    if (!ip) {
        showToast('IP not found', 'error');
        return;
    }

    document.getElementById('editIPAddress').value = ip.ipAddress;
    document.getElementById('editIPDNS').value = ip.dnsName || '';
    document.getElementById('editIPStatus').value = ip.status;

    populateReservationTypeSelect('editIPReservationType');
    document.getElementById('editIPReservationType').value = ip.reservationType || 'other';
    document.getElementById('editIPDescription').value = ip.reservationDescription || '';

    populateHostSelect();
    document.getElementById('editIPHost').value = ip.hostId || '';

    openModal('editIPModal');
}

function saveEditIP(e) {
    e.preventDefault();

    const ipAddress = document.getElementById('editIPAddress').value;
    const dnsName = document.getElementById('editIPDNS').value;
    const status = document.getElementById('editIPStatus').value;
    const reservationType = document.getElementById('editIPReservationType').value;
    const description = document.getElementById('editIPDescription').value;
    const hostId = document.getElementById('editIPHost').value;

    const ips = DB.get(DB.KEYS.IPS);
    const ipRecord = ips.find(i => i.ipAddress === ipAddress);

    if (ipRecord) {
        ipRecord.dnsName = dnsName;
        ipRecord.status = status;
        ipRecord.reservationType = status === 'reserved' ? reservationType : null;
        ipRecord.reservationDescription = status === 'reserved' ? description : null;
        ipRecord.hostId = status === 'assigned' && hostId ? hostId : null;
        ipRecord.updatedAt = new Date().toISOString();
        DB.set(DB.KEYS.IPS, ips);

        showToast('IP updated successfully', 'success');
        closeModal();
        refreshIPsTable();
        refreshDashboard();
    } else {
        showToast('IP not found', 'error');
    }
}

// ============================================
// Enhanced Navigation
// ============================================

function navigateToExtended(page) {
    switch (page) {
        case 'vlans':
            refreshVLANsTable();
            populateCompanyFilters();
            break;
        case 'ip-ranges':
            refreshIPRangesTable();
            break;
        case 'templates':
            refreshTemplatesGrid();
            break;
        case 'conflicts':
            refreshConflictsPanel();
            break;
    }
}

// Override navigation to include new pages
const originalNavigateTo = navigateTo;
navigateTo = function(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === page);
    });

    switch (page) {
        case 'dashboard':
            refreshDashboard();
            refreshConflictsPanel();
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
            initIPAMCompactView();
            break;
        case 'vlans':
            refreshVLANsTable();
            populateCompanyFilters();
            break;
        case 'ip-ranges':
            refreshIPRangesTable();
            break;
        case 'templates':
            refreshTemplatesGrid();
            break;
        case 'import':
            populateImportCompanySelect();
            break;
        case 'audit-log':
            refreshAuditLog();
            break;
        case 'maintenance':
            refreshMaintenanceTable();
            break;
        case 'ip-history':
            refreshIPHistoryPage();
            break;
        case 'lifecycle':
            refreshLifecycleDashboard();
            break;
    }
};

// ============================================
// Enhanced Dashboard with Conflicts
// ============================================

const originalRefreshDashboard = refreshDashboard;
refreshDashboard = function() {
    originalRefreshDashboard();

    // Update conflict indicator
    const conflicts = ConflictDetector.checkForConflicts();
    const conflictIndicator = document.getElementById('dashboardConflicts');
    if (conflictIndicator) {
        if (conflicts.length > 0) {
            conflictIndicator.innerHTML = `
                <div class="alert alert-warning" onclick="navigateTo('ipam')">
                    <span class="alert-icon">⚠️</span>
                    <span>${conflicts.length} IP conflict${conflicts.length !== 1 ? 's' : ''} detected</span>
                    <span class="alert-action">View Details →</span>
                </div>
            `;
        } else {
            conflictIndicator.innerHTML = '';
        }
    }
};

// ============================================
// Populate VLAN Select for Subnets
// ============================================

function populateVLANSelect(selectId) {
    const vlans = VLANManager.getAll();
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- No VLAN --</option>' +
        vlans.map(v => `<option value="${v.vlanId}">VLAN ${v.vlanId} - ${v.name}</option>`).join('');
}

// ============================================
// Dark Mode Toggle
// ============================================

function toggleDarkMode() {
    const isDark = Settings.get('darkMode');
    Settings.set('darkMode', !isDark);
    applyDarkMode(!isDark);
}

function applyDarkMode(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const btn = document.getElementById('darkModeBtn');
    if (btn) {
        btn.innerHTML = isDark ?
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' :
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    }
}

// ============================================
// Audit Log UI
// ============================================

function refreshAuditLog() {
    const logs = AuditLog.getAll(50);
    const container = document.getElementById('auditLogContent');

    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = '<p class="empty-state">No activity recorded yet</p>';
        return;
    }

    container.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleString();

        const actionIcons = {
            'create': '➕',
            'update': '✏️',
            'delete': '🗑️',
            'assign': '🔗',
            'release': '🔓',
            'reserve': '🔒'
        };

        const icon = actionIcons[log.action] || '📝';

        return `
            <div class="audit-log-item">
                <span class="audit-icon">${icon}</span>
                <div class="audit-details">
                    <span class="audit-action">${log.action.toUpperCase()}</span>
                    <span class="audit-entity">${log.entityType}</span>
                    <p class="audit-description">${escapeHtml(log.details)}</p>
                    <span class="audit-time">${timeStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

function clearAuditLog() {
    if (!confirm('Clear all audit log entries?')) return;
    AuditLog.clear();
    refreshAuditLog();
    showToast('Audit log cleared', 'success');
}

// ============================================
// Subnet Calculator UI
// ============================================

function showSubnetCalculator() {
    document.getElementById('subnetCalcForm').reset();
    document.getElementById('subnetCalcResults').innerHTML = '';
    openModal('subnetCalculatorModal');
}

function calculateSubnet() {
    const ip = document.getElementById('calcIP').value;
    const cidr = document.getElementById('calcCIDR').value;

    const result = SubnetCalculator.calculate(ip, cidr);
    const container = document.getElementById('subnetCalcResults');

    if (result.error) {
        container.innerHTML = `<div class="calc-error">${result.error}</div>`;
        return;
    }

    container.innerHTML = `
        <div class="calc-results-grid">
            <div class="calc-result-item">
                <label>Network Address</label>
                <span class="calc-value monospace">${result.networkAddress}</span>
            </div>
            <div class="calc-result-item">
                <label>Broadcast Address</label>
                <span class="calc-value monospace">${result.broadcastAddress}</span>
            </div>
            <div class="calc-result-item">
                <label>Subnet Mask</label>
                <span class="calc-value monospace">${result.subnetMask}</span>
            </div>
            <div class="calc-result-item">
                <label>Wildcard Mask</label>
                <span class="calc-value monospace">${result.wildcardMask}</span>
            </div>
            <div class="calc-result-item">
                <label>First Usable IP</label>
                <span class="calc-value monospace">${result.firstUsableIP}</span>
            </div>
            <div class="calc-result-item">
                <label>Last Usable IP</label>
                <span class="calc-value monospace">${result.lastUsableIP}</span>
            </div>
            <div class="calc-result-item">
                <label>Usable Hosts</label>
                <span class="calc-value">${result.usableHosts.toLocaleString()}</span>
            </div>
            <div class="calc-result-item">
                <label>Total Addresses</label>
                <span class="calc-value">${Math.pow(2, 32 - result.cidr).toLocaleString()}</span>
            </div>
            <div class="calc-result-item">
                <label>IP Class</label>
                <span class="calc-value">${result.ipClass}</span>
            </div>
            <div class="calc-result-item">
                <label>IP Type</label>
                <span class="calc-value">${result.isPrivate ? 'Private' : 'Public'}</span>
            </div>
            <div class="calc-result-item full-width">
                <label>CIDR Notation</label>
                <span class="calc-value monospace">${result.notation}</span>
            </div>
            <div class="calc-result-item full-width">
                <label>Binary Mask</label>
                <span class="calc-value monospace small">${result.binaryMask}</span>
            </div>
        </div>
    `;
}

// ============================================
// Maintenance Windows UI
// ============================================

function refreshMaintenanceTable() {
    const tbody = document.querySelector('#maintenanceTable tbody');
    if (!tbody) return;

    const windows = MaintenanceManager.getAll();

    if (windows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No maintenance windows scheduled</td></tr>`;
        return;
    }

    tbody.innerHTML = windows.map(mw => {
        const startDate = new Date(mw.startTime);
        const endDate = new Date(mw.endTime);
        const duration = Math.round((endDate - startDate) / (1000 * 60 * 60 * 10)) / 10; // hours

        return `
            <tr class="${mw.isActive ? 'row-active' : ''} ${mw.isPast ? 'row-past' : ''}">
                <td>
                    <span class="maintenance-type-badge" style="background: ${mw.typeColor}20; color: ${mw.typeColor}">
                        ${mw.typeIcon} ${mw.typeName}
                    </span>
                </td>
                <td>
                    <strong>${mw.title}</strong>
                    ${mw.description ? `<br><small class="text-muted">${mw.description}</small>` : ''}
                </td>
                <td>${startDate.toLocaleString()}</td>
                <td>${duration}h</td>
                <td>
                    ${mw.affectedHostNames.length > 0 ? mw.affectedHostNames.slice(0, 3).join(', ') : '-'}
                    ${mw.affectedHostNames.length > 3 ? ` +${mw.affectedHostNames.length - 3} more` : ''}
                </td>
                <td>
                    <span class="status-badge" style="background: ${mw.statusColor}20; color: ${mw.statusColor}">
                        ${mw.statusName}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${mw.status === 'scheduled' ? `
                            <button class="btn-icon" onclick="startMaintenance('${mw.id}')" title="Start">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                        ` : ''}
                        ${mw.status === 'in_progress' ? `
                            <button class="btn-icon" onclick="completeMaintenance('${mw.id}')" title="Complete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="showEditMaintenanceModal('${mw.id}')" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" onclick="deleteMaintenance('${mw.id}')" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddMaintenanceModal() {
    document.getElementById('maintenanceForm').reset();
    document.getElementById('maintenanceEditId').value = '';
    document.getElementById('maintenanceModalTitle').textContent = 'Schedule Maintenance';

    // Set default times
    const now = new Date();
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

    document.getElementById('maintenanceStart').value = start.toISOString().slice(0, 16);
    document.getElementById('maintenanceEnd').value = end.toISOString().slice(0, 16);

    // Populate host checkboxes
    populateMaintenanceHostList();

    openModal('addMaintenanceModal');
}

function showEditMaintenanceModal(id) {
    const mw = MaintenanceManager.getById(id);
    if (!mw) return;

    document.getElementById('maintenanceEditId').value = id;
    document.getElementById('maintenanceModalTitle').textContent = 'Edit Maintenance';
    document.getElementById('maintenanceTitle').value = mw.title;
    document.getElementById('maintenanceDescription').value = mw.description || '';
    document.getElementById('maintenanceType').value = mw.type;
    document.getElementById('maintenanceStart').value = mw.startTime.slice(0, 16);
    document.getElementById('maintenanceEnd').value = mw.endTime.slice(0, 16);
    document.getElementById('maintenanceImpact').value = mw.impact || 'partial';
    document.getElementById('maintenanceNotes').value = mw.notes || '';

    populateMaintenanceHostList(mw.hostIds);

    openModal('addMaintenanceModal');
}

function populateMaintenanceHostList(selectedIds = []) {
    const container = document.getElementById('maintenanceHostList');
    if (!container) return;

    const hosts = HostManager.getAll();
    container.innerHTML = hosts.map(host => `
        <label class="checkbox-item">
            <input type="checkbox" name="maintenanceHosts" value="${host.id}"
                ${selectedIds.includes(host.id) ? 'checked' : ''}>
            <span>${host.vmName}</span>
        </label>
    `).join('');
}

function saveMaintenance(event) {
    event.preventDefault();

    const editId = document.getElementById('maintenanceEditId').value;
    const selectedHosts = Array.from(document.querySelectorAll('input[name="maintenanceHosts"]:checked'))
        .map(cb => cb.value);

    const data = {
        title: document.getElementById('maintenanceTitle').value,
        description: document.getElementById('maintenanceDescription').value,
        type: document.getElementById('maintenanceType').value,
        startTime: document.getElementById('maintenanceStart').value,
        endTime: document.getElementById('maintenanceEnd').value,
        impact: document.getElementById('maintenanceImpact').value,
        notes: document.getElementById('maintenanceNotes').value,
        hostIds: selectedHosts
    };

    let result;
    if (editId) {
        result = MaintenanceManager.update(editId, data);
    } else {
        result = MaintenanceManager.add(data);
    }

    if (result.success) {
        showToast(editId ? 'Maintenance updated' : 'Maintenance scheduled', 'success');
        closeModal();
        refreshMaintenanceTable();
    } else {
        showToast(result.message, 'error');
    }
}

function startMaintenance(id) {
    if (confirm('Start this maintenance window now?')) {
        MaintenanceManager.updateStatus(id, 'in_progress');
        showToast('Maintenance started', 'success');
        refreshMaintenanceTable();
    }
}

function completeMaintenance(id) {
    if (confirm('Mark this maintenance as completed?')) {
        MaintenanceManager.updateStatus(id, 'completed');
        showToast('Maintenance completed', 'success');
        refreshMaintenanceTable();
    }
}

function deleteMaintenance(id) {
    if (confirm('Delete this maintenance window?')) {
        MaintenanceManager.delete(id);
        showToast('Maintenance deleted', 'success');
        refreshMaintenanceTable();
    }
}

// ============================================
// IP History UI
// ============================================

function showIPHistoryModal(ipAddress) {
    const history = IPHistory.getByIP(ipAddress, 50);
    const timeline = IPHistory.getAssignmentTimeline(ipAddress);

    const content = document.getElementById('ipHistoryContent');
    if (!content) return;

    if (history.length === 0) {
        content.innerHTML = '<p class="empty-state">No history recorded for this IP</p>';
    } else {
        content.innerHTML = `
            <div class="ip-history-header">
                <h4>${ipAddress}</h4>
                <p class="text-muted">${history.length} events recorded</p>
            </div>

            ${timeline.length > 0 ? `
                <div class="ip-timeline-summary">
                    <h5>Assignment Timeline</h5>
                    <div class="timeline-list">
                        ${timeline.map(t => `
                            <div class="timeline-item">
                                <span class="timeline-host">${t.hostName || 'Unknown'}</span>
                                <span class="timeline-dates">
                                    ${new Date(t.startDate).toLocaleDateString()} -
                                    ${t.endDate ? new Date(t.endDate).toLocaleDateString() : 'Present'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="ip-history-events">
                <h5>Event Log</h5>
                ${history.map(h => `
                    <div class="history-event ${h.action}">
                        <div class="event-icon ${h.action}">
                            ${h.action === 'assigned' ? '➕' : h.action === 'released' ? '➖' : '🔄'}
                        </div>
                        <div class="event-details">
                            <div class="event-action">
                                ${h.action.charAt(0).toUpperCase() + h.action.slice(1)}
                                ${h.hostName ? ` to <strong>${h.hostName}</strong>` : ''}
                                ${h.previousHostName ? ` (from ${h.previousHostName})` : ''}
                            </div>
                            <div class="event-time">${new Date(h.timestamp).toLocaleString()}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    openModal('ipHistoryModal');
}

function refreshIPHistoryPage() {
    const container = document.getElementById('ipHistoryList');
    if (!container) return;

    const recentHistory = IPHistory.getRecent(100);
    const stats = IPHistory.getStats();

    // Update stats
    const statsContainer = document.getElementById('ipHistoryStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-mini">
                <span class="stat-value">${stats.totalEntries}</span>
                <span class="stat-label">Total Events</span>
            </div>
            <div class="stat-mini">
                <span class="stat-value">${stats.uniqueIPs}</span>
                <span class="stat-label">Unique IPs</span>
            </div>
            <div class="stat-mini">
                <span class="stat-value">${stats.totalAssignments}</span>
                <span class="stat-label">Assignments</span>
            </div>
            <div class="stat-mini">
                <span class="stat-value">${stats.recentActivity}</span>
                <span class="stat-label">Last 30 Days</span>
            </div>
        `;
    }

    if (recentHistory.length === 0) {
        container.innerHTML = '<p class="empty-state">No IP history recorded yet</p>';
        return;
    }

    container.innerHTML = recentHistory.map(h => `
        <div class="history-event-row ${h.action}">
            <div class="event-ip" onclick="showIPHistoryModal('${h.ipAddress}')">${h.ipAddress}</div>
            <div class="event-action-badge ${h.action}">${h.action}</div>
            <div class="event-host">${h.hostName || '-'}</div>
            <div class="event-time">${new Date(h.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

// ============================================
// Hardware Lifecycle UI
// ============================================

function refreshLifecycleDashboard() {
    const container = document.getElementById('lifecycleContent');
    if (!container) return;

    const summary = HardwareLifecycle.getSummary();
    const needsAttention = HardwareLifecycle.getHostsNeedingAttention();
    const warrantySoon = HardwareLifecycle.getWarrantyExpiringSoon(30);
    const eolSoon = HardwareLifecycle.getEOLSoon(180);

    container.innerHTML = `
        <div class="lifecycle-stats">
            <div class="lifecycle-stat">
                <span class="stat-value">${summary.total}</span>
                <span class="stat-label">Total Hosts</span>
            </div>
            <div class="lifecycle-stat">
                <span class="stat-value">${summary.withLifecycleData}</span>
                <span class="stat-label">With Lifecycle Data</span>
            </div>
            <div class="lifecycle-stat success">
                <span class="stat-value">${summary.underWarranty}</span>
                <span class="stat-label">Under Warranty</span>
            </div>
            <div class="lifecycle-stat warning">
                <span class="stat-value">${summary.warrantyExpiringSoon}</span>
                <span class="stat-label">Warranty Expiring</span>
            </div>
            <div class="lifecycle-stat danger">
                <span class="stat-value">${summary.outOfWarranty}</span>
                <span class="stat-label">Out of Warranty</span>
            </div>
            <div class="lifecycle-stat danger">
                <span class="stat-value">${summary.eol}</span>
                <span class="stat-label">End of Life</span>
            </div>
            <div class="lifecycle-stat">
                <span class="stat-value">${summary.averageAge} yrs</span>
                <span class="stat-label">Average Age</span>
            </div>
        </div>

        ${needsAttention.length > 0 ? `
            <div class="lifecycle-alerts">
                <h4>Hosts Needing Attention</h4>
                <div class="alert-list">
                    ${needsAttention.map(host => `
                        <div class="alert-item" style="border-left: 3px solid ${host.lifecycleAlert.color}">
                            <div class="alert-icon">${host.lifecycleAlert.icon}</div>
                            <div class="alert-details">
                                <strong>${host.vmName}</strong>
                                <span class="alert-status" style="color: ${host.lifecycleAlert.color}">
                                    ${host.lifecycleAlert.name}
                                </span>
                                ${host.warrantyExpiry ? `<span class="alert-date">Warranty: ${new Date(host.warrantyExpiry).toLocaleDateString()}</span>` : ''}
                                ${host.eolDate ? `<span class="alert-date">EOL: ${new Date(host.eolDate).toLocaleDateString()}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        ${warrantySoon.length > 0 ? `
            <div class="lifecycle-section">
                <h4>Warranty Expiring in 30 Days</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Host</th>
                            <th>Vendor</th>
                            <th>Warranty Expiry</th>
                            <th>Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${warrantySoon.map(host => `
                            <tr>
                                <td>${host.vmName}</td>
                                <td>${host.vendor || '-'}</td>
                                <td>${new Date(host.warrantyExpiry).toLocaleDateString()}</td>
                                <td><span class="days-badge warning">${HardwareLifecycle.getDaysUntilWarrantyExpiry(host.warrantyExpiry)} days</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}

        ${eolSoon.length > 0 ? `
            <div class="lifecycle-section">
                <h4>End of Life in 6 Months</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Host</th>
                            <th>Model</th>
                            <th>EOL Date</th>
                            <th>Days Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eolSoon.map(host => `
                            <tr>
                                <td>${host.vmName}</td>
                                <td>${host.model || '-'}</td>
                                <td>${new Date(host.eolDate).toLocaleDateString()}</td>
                                <td><span class="days-badge danger">${HardwareLifecycle.getDaysUntilEOL(host.eolDate)} days</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;
}

function getLifecycleStatusBadge(host) {
    const status = HardwareLifecycle.getStatus(host);
    if (!status) return '';

    return `<span class="lifecycle-badge" style="background: ${status.color}20; color: ${status.color}">
        ${status.icon} ${status.name}
    </span>`;
}

// ============================================
// Initialize Application
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize compact view button state
    const compactBtn = document.getElementById('compactViewBtn');
    if (compactBtn && compactView) {
        compactBtn.classList.add('active');
    }

    // Apply dark mode if enabled
    const isDarkMode = Settings.get('darkMode');
    applyDarkMode(isDarkMode);

    refreshDashboard();
    refreshConflictsPanel();
    console.log('NetManager v5.0 initialized with VLAN, IP Ranges, Templates, Reservations, Conflict Detection, Audit Log, Dark Mode, Subnet Calculator, IP History, Hardware Lifecycle, and Maintenance Windows');
});
