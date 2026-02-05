const HardwareLifecycle = {
    getStatus(host) {
        if (!host.purchaseDate && !host.warrantyExpiry && !host.eolDate) {
            return null;
        }
        const now = new Date();
        const warrantyExpiry = host.warrantyExpiry ? new Date(host.warrantyExpiry) : null;
        const eolDate = host.eolDate ? new Date(host.eolDate) : null;
        if (host.lifecycleStatus === 'decommissioned') {
            return LIFECYCLE_STATUS.find(s => s.id === 'decommissioned');
        }
        if (eolDate && now >= eolDate) {
            return LIFECYCLE_STATUS.find(s => s.id === 'eol');
        }
        if (eolDate) {
            const sixMonthsBefore = new Date(eolDate);
            sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
            if (now >= sixMonthsBefore) {
                return LIFECYCLE_STATUS.find(s => s.id === 'eol_announced');
            }
        }
        if (warrantyExpiry) {
            if (now > warrantyExpiry) {
                return LIFECYCLE_STATUS.find(s => s.id === 'out_of_warranty');
            }
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
        return Math.round(years * 10) / 10; 
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
