const SavedFilters = {
    getAll() {
        return DB.get(DB.KEYS.SAVED_FILTERS);
    },
    getByPage(page) {
        const filters = this.getAll();
        return filters.filter(f => f.page === page);
    },
    getById(id) {
        const filters = this.getAll();
        return filters.find(f => f.id === id);
    },
    save(name, page, filterState) {
        const filters = DB.get(DB.KEYS.SAVED_FILTERS);
        const newFilter = {
            id: DB.generateId(),
            name: name,
            page: page,
            filters: filterState,
            createdAt: new Date().toISOString()
        };
        filters.push(newFilter);
        DB.set(DB.KEYS.SAVED_FILTERS, filters);
        return { success: true, filter: newFilter };
    },
    update(id, name) {
        const filters = DB.get(DB.KEYS.SAVED_FILTERS);
        const index = filters.findIndex(f => f.id === id);
        if (index === -1) {
            return { success: false, message: 'Filter not found' };
        }
        filters[index].name = name;
        filters[index].updatedAt = new Date().toISOString();
        DB.set(DB.KEYS.SAVED_FILTERS, filters);
        return { success: true };
    },
    delete(id) {
        const filters = DB.get(DB.KEYS.SAVED_FILTERS);
        const filtered = filters.filter(f => f.id !== id);
        DB.set(DB.KEYS.SAVED_FILTERS, filtered);
        return { success: true };
    },
    getCurrentFilterState(page) {
        const state = {};
        switch(page) {
            case 'hosts':
                state.search = document.getElementById('hostSearch')?.value || '';
                state.state = document.getElementById('hostStateFilter')?.value || '';
                state.company = document.getElementById('hostCompanyFilter')?.value || '';
                state.type = document.getElementById('hostTypeFilter')?.value || '';
                break;
            case 'ipam':
                state.search = document.getElementById('ipSearch')?.value || '';
                state.subnet = document.getElementById('ipSubnetFilter')?.value || '';
                state.status = document.getElementById('ipStatusFilter')?.value || '';
                break;
            case 'vlans':
                state.search = document.getElementById('vlanSearch')?.value || '';
                state.type = document.getElementById('vlanTypeFilter')?.value || '';
                state.company = document.getElementById('vlanCompanyFilter')?.value || '';
                break;
        }
        return state;
    },
    applyFilterState(page, state) {
        switch(page) {
            case 'hosts':
                if (state.search) document.getElementById('hostSearch').value = state.search;
                if (state.state) document.getElementById('hostStateFilter').value = state.state;
                if (state.company) document.getElementById('hostCompanyFilter').value = state.company;
                if (state.type) document.getElementById('hostTypeFilter').value = state.type;
                refreshHostsTable();
                break;
            case 'ipam':
                if (state.search) document.getElementById('ipSearch').value = state.search;
                if (state.subnet) document.getElementById('ipSubnetFilter').value = state.subnet;
                if (state.status) document.getElementById('ipStatusFilter').value = state.status;
                refreshIPsTable();
                break;
            case 'vlans':
                if (state.search) document.getElementById('vlanSearch').value = state.search;
                if (state.type) document.getElementById('vlanTypeFilter').value = state.type;
                if (state.company) document.getElementById('vlanCompanyFilter').value = state.company;
                refreshVLANsTable();
                break;
        }
    }
};
