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
        AuditLog.log('create', 'subnet_template', newTemplate.id,
            `Created subnet template: ${newTemplate.name}`, null, newTemplate);
        return { success: true, message: 'Template added successfully', template: newTemplate };
    },
    delete(id) {
        const templates = DB.get(DB.KEYS.SUBNET_TEMPLATES);
        const template = templates.find(t => t.id === id);
        if (!template) {
            return { success: false, message: 'Template not found or is a default template' };
        }
        const newTemplates = templates.filter(t => t.id !== id);
        DB.set(DB.KEYS.SUBNET_TEMPLATES, newTemplates);
        AuditLog.log('delete', 'subnet_template', id,
            `Deleted subnet template: ${template.name}`, template, null);
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
        if (template.reservations) {
            template.reservations.forEach(res => {
                const ip = IPUtils.intToIp(networkInt + res.offset);
                const result = IPManager.updateStatus(ip, 'reserved', null);
                if (result.success) {
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
