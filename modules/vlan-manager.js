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
        AuditLog.log('create', 'vlan', newVLAN.id,
            `Created VLAN ${newVLAN.vlanId}: ${newVLAN.name}`, null, newVLAN);
        return { success: true, message: 'VLAN added successfully', vlan: newVLAN };
    },
    update(id, updates) {
        const vlans = DB.get(DB.KEYS.VLANS);
        const index = vlans.findIndex(v => v.id === id);
        if (index === -1) {
            return { success: false, message: 'VLAN not found' };
        }
        const oldVLAN = { ...vlans[index] };
        vlans[index] = { ...vlans[index], ...updates, updatedAt: new Date().toISOString() };
        DB.set(DB.KEYS.VLANS, vlans);
        AuditLog.log('update', 'vlan', id,
            `Updated VLAN ${vlans[index].vlanId}: ${vlans[index].name}`, oldVLAN, vlans[index]);
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
        AuditLog.log('delete', 'vlan', id,
            `Deleted VLAN ${vlan.vlanId}: ${vlan.name}`, vlan, null);
        return { success: true, message: 'VLAN deleted successfully' };
    }
};
