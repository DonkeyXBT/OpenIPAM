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
            code: data.code || data.name.substring(0, 3).toUpperCase(),
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
