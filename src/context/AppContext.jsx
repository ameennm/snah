import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { PERMISSIONS } from '../data/mockData';

const API_BASE = 'https://snah-api.snahorganics2026.workers.dev/api';
export { API_BASE };

const AppContext = createContext();

const savedUser = localStorage.getItem('snah_user');
const initialState = {
    user: savedUser ? JSON.parse(savedUser) : null,
    customers: [],
    products: [],
    orders: [],
    ordersTotal: 0,
    ledger: [],
    crmLeads: [],
    crmLeadsTotal: 0,
    sidebarOpen: false,
    loading: !!savedUser,
};

// Counter for temporary IDs (negative to never collide with DB IDs)
let tempIdCounter = -1;
function nextTempId() { return tempIdCounter--; }

function appReducer(state, action) {
    switch (action.type) {
        case 'LOGIN':
            localStorage.setItem('snah_user', JSON.stringify(action.payload));
            return { ...state, user: action.payload };
        case 'LOGOUT':
            localStorage.removeItem('snah_user');
            return { ...state, user: null, sidebarOpen: false };
        case 'TOGGLE_SIDEBAR':
            return { ...state, sidebarOpen: !state.sidebarOpen };
        case 'CLOSE_SIDEBAR':
            return { ...state, sidebarOpen: false };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };

        // Bulk data from API
        case 'SET_CUSTOMERS':
            return { ...state, customers: Array.isArray(action.payload) ? action.payload : (action.payload?.results || []) };
        case 'SET_PRODUCTS':
            return { ...state, products: Array.isArray(action.payload) ? action.payload : (action.payload?.results || []) };
        case 'SET_ORDERS':
            return { 
                ...state, 
                orders: action.payload?.results || (Array.isArray(action.payload) ? action.payload : []), 
                ordersTotal: action.payload?.total || (Array.isArray(action.payload) ? action.payload.length : (state.ordersTotal || 0)) 
            };
        case 'SET_LEDGER':
            return { ...state, ledger: Array.isArray(action.payload) ? action.payload : (action.payload?.results || []) };

        // Optimistic CRUD
        case 'ADD_CUSTOMER':
            return { ...state, customers: [...state.customers, action.payload] };
        case 'UPDATE_CUSTOMER':
            return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
        case 'DELETE_CUSTOMER':
            return { ...state, customers: state.customers.filter(c => c.id !== action.payload) };
        case 'REPLACE_CUSTOMER':
            return { ...state, customers: state.customers.map(c => c.id === action.payload.tempId ? { ...c, ...action.payload.real } : c) };

        case 'ADD_PRODUCT':
            return { ...state, products: [...state.products, action.payload] };
        case 'UPDATE_PRODUCT':
            return { ...state, products: state.products.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
        case 'DELETE_PRODUCT':
            return { ...state, products: state.products.filter(p => p.id !== action.payload) };
        case 'REPLACE_PRODUCT':
            return { ...state, products: state.products.map(p => p.id === action.payload.tempId ? { ...p, ...action.payload.real } : p) };

        case 'ADD_ORDER': {
            const order = action.payload;
            const updatedProducts = state.products.map(p => {
                const item = order.items?.find(i => i.productId === p.id);
                if (item) return { ...p, stock: p.stock - item.quantity };
                return p;
            });
            return { ...state, orders: [order, ...state.orders], products: updatedProducts };
        }
        case 'UPDATE_ORDER':
            return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o) };
        case 'DELETE_ORDER': {
            const delOrder = state.orders.find(o => o.id === action.payload);
            let restoredProducts = state.products;
            if (delOrder && delOrder.status !== 'returned') {
                restoredProducts = state.products.map(p => {
                    const item = delOrder.items?.find(i => i.productId === p.id);
                    if (item) return { ...p, stock: p.stock + item.quantity };
                    return p;
                });
            }
            return { ...state, orders: state.orders.filter(o => o.id !== action.payload), products: restoredProducts };
        }
        case 'REPLACE_ORDER':
            return { ...state, orders: state.orders.map(o => o.id === action.payload.tempId ? { ...o, ...action.payload.real } : o) };
        case 'RETURN_ORDER_STOCK': {
            const retOrder = state.orders.find(o => o.id === action.payload);
            if (!retOrder) return state;
            const restored = state.products.map(p => {
                const item = retOrder.items?.find(i => i.productId === p.id);
                if (item) return { ...p, stock: p.stock + item.quantity };
                return p;
            });
            return { ...state, products: restored };
        }

        case 'ADD_LEDGER_ENTRY':
            return { ...state, ledger: [action.payload, ...state.ledger] };
        case 'UPDATE_LEDGER_ENTRY':
            return { ...state, ledger: state.ledger.map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l) };
        case 'DELETE_LEDGER_ENTRY':
            return { ...state, ledger: state.ledger.filter(l => l.id !== action.payload) };
        case 'REPLACE_LEDGER':
            return { ...state, ledger: state.ledger.map(l => l.id === action.payload.tempId ? { ...l, ...action.payload.real } : l) };

        // CRM Leads
        case 'SET_CRM_LEADS':
            return { 
                ...state, 
                crmLeads: action.payload?.results || (Array.isArray(action.payload) ? action.payload : []), 
                crmLeadsTotal: action.payload?.total || (Array.isArray(action.payload) ? action.payload.length : (state.crmLeadsTotal || 0))
            };
        case 'ADD_CRM_LEAD':
            return { ...state, crmLeads: [action.payload, ...state.crmLeads] };
        case 'UPDATE_CRM_LEAD':
            return { ...state, crmLeads: state.crmLeads.map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l) };
        case 'DELETE_CRM_LEAD':
            return { ...state, crmLeads: state.crmLeads.filter(l => l.id !== action.payload) };
        case 'REPLACE_CRM_LEAD':
            return { ...state, crmLeads: state.crmLeads.map(l => l.id === action.payload.tempId ? { ...l, ...action.payload.real } : l) };

        default:
            return state;
    }
}

// API helper — unexported to fix Vite Fast Refresh (React components should not export functions)
async function api(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    
    let data;
    try {
        data = await res.json();
    } catch (e) {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return null;
    }

    if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
    return data;
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const dataLoaded = useRef(false);

    useEffect(() => {
        if (state.user) {
            if (!dataLoaded.current) {
                dataLoaded.current = true;
                loadAllData();
            }
        } else {
            dataLoaded.current = false;
        }
    }, [state.user]);

    const loadAllData = async (isBackground = false) => {
        if (!isBackground) dispatch({ type: 'SET_LOADING', payload: true });
        try {
            // Only load cross-page data centrally.
            // Orders and CRM leads are managed by their own pages to avoid overwriting pagination state.
            const [customers, products, ledger] = await Promise.all([
                api('/customers'),
                api('/products'),
                api('/ledger'),
            ]);
            dispatch({ type: 'SET_CUSTOMERS', payload: customers });
            dispatch({ type: 'SET_PRODUCTS', payload: products });
            dispatch({ type: 'SET_LEDGER', payload: ledger });

            // On first load only, seed the orders and leads with page 1 so the 
            // pages have data to show before their own useEffect fires.
            if (!isBackground) {
                const [ordersData, crmLeadsData] = await Promise.all([
                    api(`/orders?role=${state.user?.role || ''}&limit=20&offset=0`),
                    api(`/crm/leads?userId=${state.user?.id || ''}&role=${state.user?.role || ''}&limit=20&offset=0&tab=my-leads&status=active`),
                ]);
                dispatch({ type: 'SET_ORDERS', payload: ordersData });
                dispatch({ type: 'SET_CRM_LEADS', payload: crmLeadsData });
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        }
        if (!isBackground) dispatch({ type: 'SET_LOADING', payload: false });
    };

    // ====== AUTH ======
    const login = useCallback(async (username, password) => {
        try {
            const result = await api('/login', { method: 'POST', body: { username, password } });
            if (result.success) {
                dispatch({ type: 'LOGIN', payload: result.user });
                return { success: true };
            }
            return { success: false, error: result.error || 'Invalid credentials' };
        } catch {
            return { success: false, error: 'Connection error. Please try again.' };
        }
    }, []);

    const logout = useCallback(() => dispatch({ type: 'LOGOUT' }), []);

    // ====== PERMISSIONS ======
    const hasPermission = useCallback(
        (perm) => {
            if (!state.user) return false;
            // Admin has all permissions
            if (state.user.role === 'super_admin') return true;

            // Check if any assigned role has the permission
            const roles = state.user.roles || [state.user.role];
            return roles.some(r => PERMISSIONS[r]?.[perm]);
        },
        [state.user]
    );

    // ====== CUSTOMERS (Optimistic & Async) ======
    const addCustomer = useCallback((data) => {
        const tempId = nextTempId();
        const optimistic = { ...data, id: tempId, address: data.address || '', area: data.area || '' };
        dispatch({ type: 'ADD_CUSTOMER', payload: optimistic });

        // Sync in background
        api('/customers', { method: 'POST', body: data })
            .then(real => dispatch({ type: 'REPLACE_CUSTOMER', payload: { tempId, real } }))
            .catch(() => dispatch({ type: 'DELETE_CUSTOMER', payload: tempId }));

        return optimistic;
    }, []);

    const addCustomerAsync = useCallback(async (data) => {
        const real = await api('/customers', { method: 'POST', body: data });
        dispatch({ type: 'ADD_CUSTOMER', payload: real });
        return real;
    }, []);

    const updateCustomer = useCallback((data) => {
        dispatch({ type: 'UPDATE_CUSTOMER', payload: data });
        api(`/customers/${data.id}`, { method: 'PUT', body: data }).catch(console.error);
        return data;
    }, []);

    const deleteCustomer = useCallback((id) => {
        dispatch({ type: 'DELETE_CUSTOMER', payload: id });
        if (state.user?.id) {
            api(`/customers/${id}?userId=${state.user.id}`, { method: 'DELETE' }).catch(console.error);
        }
    }, [state.user?.id]);

    // ====== PRODUCTS (Optimistic) ======
    const addProduct = useCallback((data) => {
        const tempId = nextTempId();
        const optimistic = { ...data, id: tempId };
        dispatch({ type: 'ADD_PRODUCT', payload: optimistic });

        api('/products', { method: 'POST', body: data })
            .then(real => dispatch({ type: 'REPLACE_PRODUCT', payload: { tempId, real } }))
            .catch(() => dispatch({ type: 'DELETE_PRODUCT', payload: tempId }));

        return optimistic;
    }, []);

    const updateProduct = useCallback((data) => {
        dispatch({ type: 'UPDATE_PRODUCT', payload: data });
        api(`/products/${data.id}`, { method: 'PUT', body: data }).catch(console.error);
        return data;
    }, []);

    const deleteProduct = useCallback((id) => {
        dispatch({ type: 'DELETE_PRODUCT', payload: id });
        if (state.user?.id) {
            api(`/products/${id}?userId=${state.user.id}`, { method: 'DELETE' }).catch(console.error);
        }
    }, [state.user?.id]);

    // ====== ORDERS (Optimistic) ======
    const addOrder = useCallback((data) => {
        return new Promise((resolve, reject) => {
            const tempId = 'ORD-TMP-' + Date.now();
            const optimistic = {
                id: tempId, customerId: data.customerId, items: data.items,
                subtotal: data.subtotal, gstAmount: data.gstAmount, total: data.total,
                discount: data.discount || 0, discountType: data.discountType || 'flat',
                paidAmount: data.paidAmount || 0, paymentStatus: data.paymentStatus,
                status: 'pending', trackingId: '', createdAt: new Date().toISOString(),
                createdBy: data.createdBy, isRedispatched: !!data.redispatchedFromId,
                redispatchedFromId: data.redispatchedFromId || null
            };
            dispatch({ type: 'ADD_ORDER', payload: optimistic });

            api('/orders', { method: 'POST', body: data })
                .then(real => {
                    dispatch({ type: 'REPLACE_ORDER', payload: { tempId, real } });
                    resolve(real);
                })
                .catch((err) => {
                    dispatch({ type: 'DELETE_ORDER', payload: tempId });
                    reject(err);
                });
        });
    }, []);

    const updateOrder = useCallback((id, data) => {
        return new Promise((resolve, reject) => {
            dispatch({ type: 'UPDATE_ORDER', payload: { id, ...data } });

            // If returning, also restore stock optimistically
            if (data.status === 'returned') {
                dispatch({ type: 'RETURN_ORDER_STOCK', payload: id });
                data.restoreStock = true;
            }

            api(`/orders/${id}`, { method: 'PUT', body: data })
                .then(res => {
                    if (res.newId && res.newId !== id) {
                        // Create a modified copy with newId 
                        dispatch({ type: 'REPLACE_ORDER', payload: { tempId: id, real: { id: res.newId } } });
                    }
                    resolve(res);
                })
                .catch(err => {
                    console.error('Update order failed:', err);
                    reject(err);
                });
        });
    }, []);

    const deleteOrder = useCallback((id) => {
        dispatch({ type: 'DELETE_ORDER', payload: id });
        if (state.user?.id) {
            api(`/orders/${id}?userId=${state.user.id}`, { method: 'DELETE' }).catch(console.error);
        }
    }, [state.user?.id]);

    // ====== LEDGER (Optimistic) ======
    const addLedgerEntry = useCallback((data) => {
        const tempId = nextTempId();
        const optimistic = { ...data, id: tempId, reference: data.reference || '', created_by: data.createdBy };
        dispatch({ type: 'ADD_LEDGER_ENTRY', payload: optimistic });

        api('/ledger', { method: 'POST', body: data })
            .then(real => dispatch({ type: 'REPLACE_LEDGER', payload: { tempId, real } }))
            .catch(() => dispatch({ type: 'DELETE_LEDGER_ENTRY', payload: tempId }));

        return optimistic;
    }, []);

    const updateLedgerEntry = useCallback((data) => {
        dispatch({ type: 'UPDATE_LEDGER_ENTRY', payload: data });
        api(`/ledger/${data.id}`, { method: 'PUT', body: data }).catch(console.error);
    }, []);

    const deleteLedgerEntry = useCallback((id) => {
        dispatch({ type: 'DELETE_LEDGER_ENTRY', payload: id });
        if (state.user?.id) {
            api(`/ledger/${id}?userId=${state.user.id}`, { method: 'DELETE' }).catch(console.error);
        }
    }, [state.user?.id]);

    // ====== CRM LEADS (Optimistic) ======
    const addCrmLead = useCallback((data) => {
        const tempId = 'CRM-TMP-' + Date.now();
        const optimistic = { ...data, id: tempId, interested_products: data.interested_products || [], is_starred: false };
        dispatch({ type: 'ADD_CRM_LEAD', payload: optimistic });
        api('/crm/leads', { method: 'POST', body: data })
            .then(real => dispatch({ type: 'REPLACE_CRM_LEAD', payload: { tempId, real } }))
            .catch(() => dispatch({ type: 'DELETE_CRM_LEAD', payload: tempId }));
        return optimistic;
    }, []);

    const updateCrmLead = useCallback((data) => {
        dispatch({ type: 'UPDATE_CRM_LEAD', payload: data });
        api(`/crm/leads/${data.id}`, { method: 'PUT', body: data }).catch(console.error);
        return data;
    }, []);

    const deleteCrmLead = useCallback((id) => {
        dispatch({ type: 'DELETE_CRM_LEAD', payload: id });
        if (state.user?.id) {
            api(`/crm/leads/${id}?userId=${state.user.id}`, { method: 'DELETE' }).catch(console.error);
        }
    }, [state.user?.id]);

    const searchOrders = useCallback(async (filters = {}) => {
        const { query = '', page = 1, limit = 20, status = 'all', paymentStatus = 'all', dateFilter = 'all' } = filters;
        const offset = (page - 1) * limit;
        const results = await api(`/orders?role=${state.user?.role || ''}&search=${encodeURIComponent(query)}&status=${status}&paymentStatus=${paymentStatus}&dateFilter=${encodeURIComponent(dateFilter)}&limit=${limit}&offset=${offset}`);
        dispatch({ type: 'SET_ORDERS', payload: results });
        return results;
    }, [state.user?.role]);

    const searchCrmLeads = useCallback(async (filters = {}) => {
        const { query = '', page = 1, limit = 20, tab = 'my-leads', status = 'active', payStatus = 'all', starredOnly = false, empFilter = 'all' } = filters;
        const offset = (page - 1) * limit;
        const url = `/crm/leads?userId=${state.user?.id || ''}&role=${state.user?.role || ''}&search=${encodeURIComponent(query)}&tab=${tab}&status=${status}&payStatus=${payStatus}&starredOnly=${starredOnly}&empFilter=${empFilter}&limit=${limit}&offset=${offset}`;
        const results = await api(url);
        dispatch({ type: 'SET_CRM_LEADS', payload: results });
        return results;
    }, [state.user?.id, state.user?.role]);

    // ====== HELPERS ======
    const getCustomerById = useCallback(
        (id) => state.customers.find(c => c.id === id),
        [state.customers]
    );

    const getProductById = useCallback(
        (id) => state.products.find(p => p.id === id),
        [state.products]
    );

    const getOrdersForCustomer = useCallback(
        (customerId) => state.orders.filter(o => o.customerId === customerId),
        [state.orders]
    );

    const value = {
        ...state,
        orders: state.orders,
        ordersTotal: state.ordersTotal,
        ledger: state.ledger,
        crmLeads: state.crmLeads,
        crmLeadsTotal: state.crmLeadsTotal,
        dispatch,
        login,
        logout,
        hasPermission,
        addCustomer,
        addCustomerAsync,
        updateCustomer,
        deleteCustomer,
        addProduct,
        updateProduct,
        deleteProduct,
        addOrder,
        updateOrder,
        deleteOrder,
        addLedgerEntry,
        updateLedgerEntry,
        deleteLedgerEntry,
        addCrmLead,
        updateCrmLead,
        deleteCrmLead,
        searchOrders,
        searchCrmLeads,
        getCustomerById,
        getProductById,
        getOrdersForCustomer,
        refreshData: loadAllData,
        api,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within an AppProvider');
    return context;
}
