import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { PERMISSIONS } from '../data/mockData';

const API_BASE = 'https://snah-api.muhammedmusthafaameennm.workers.dev/api';

const AppContext = createContext();

const initialState = {
    user: null,
    customers: [],
    products: [],
    orders: [],
    ledger: [],
    sidebarOpen: false,
    loading: true,
};

function appReducer(state, action) {
    switch (action.type) {
        case 'LOGIN':
            return { ...state, user: action.payload };
        case 'LOGOUT':
            return { ...state, user: null, sidebarOpen: false };
        case 'TOGGLE_SIDEBAR':
            return { ...state, sidebarOpen: !state.sidebarOpen };
        case 'CLOSE_SIDEBAR':
            return { ...state, sidebarOpen: false };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };

        // Data from API
        case 'SET_CUSTOMERS':
            return { ...state, customers: action.payload };
        case 'SET_PRODUCTS':
            return { ...state, products: action.payload };
        case 'SET_ORDERS':
            return { ...state, orders: action.payload };
        case 'SET_LEDGER':
            return { ...state, ledger: action.payload };

        // Optimistic local updates (sync with API)
        case 'ADD_CUSTOMER':
            return { ...state, customers: [...state.customers, action.payload] };
        case 'UPDATE_CUSTOMER':
            return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) };
        case 'DELETE_CUSTOMER':
            return { ...state, customers: state.customers.filter(c => c.id !== action.payload) };

        case 'ADD_PRODUCT':
            return { ...state, products: [...state.products, action.payload] };
        case 'UPDATE_PRODUCT':
            return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p) };
        case 'DELETE_PRODUCT':
            return { ...state, products: state.products.filter(p => p.id !== action.payload) };

        case 'ADD_ORDER': {
            const order = action.payload;
            const updatedProducts = state.products.map(p => {
                const item = order.items.find(i => i.productId === p.id);
                if (item) return { ...p, stock: p.stock - item.quantity };
                return p;
            });
            return { ...state, orders: [order, ...state.orders], products: updatedProducts };
        }
        case 'UPDATE_ORDER':
            return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o) };

        case 'ADD_LEDGER_ENTRY':
            return { ...state, ledger: [action.payload, ...state.ledger] };
        case 'DELETE_LEDGER_ENTRY':
            return { ...state, ledger: state.ledger.filter(l => l.id !== action.payload) };

        default:
            return state;
    }
}

// API helper
async function api(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return res.json();
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const dataLoaded = useRef(false);

    // Load all data when user logs in
    useEffect(() => {
        if (state.user && !dataLoaded.current) {
            dataLoaded.current = true;
            loadAllData();
        }
        if (!state.user) {
            dataLoaded.current = false;
        }
    }, [state.user]);

    const loadAllData = async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            const [customers, products, orders, ledger] = await Promise.all([
                api('/customers'),
                api('/products'),
                api('/orders'),
                api('/ledger'),
            ]);
            dispatch({ type: 'SET_CUSTOMERS', payload: customers });
            dispatch({ type: 'SET_PRODUCTS', payload: products });
            dispatch({ type: 'SET_ORDERS', payload: orders });
            dispatch({ type: 'SET_LEDGER', payload: ledger });
        } catch (err) {
            console.error('Failed to load data:', err);
        }
        dispatch({ type: 'SET_LOADING', payload: false });
    };

    // ====== AUTH ======
    const login = useCallback(async (username, password) => {
        try {
            const result = await api('/login', {
                method: 'POST',
                body: { username, password },
            });
            if (result.success) {
                dispatch({ type: 'LOGIN', payload: result.user });
                return { success: true };
            }
            return { success: false, error: result.error || 'Invalid credentials' };
        } catch {
            return { success: false, error: 'Connection error. Please try again.' };
        }
    }, []);

    const logout = useCallback(() => {
        dispatch({ type: 'LOGOUT' });
    }, []);

    // ====== PERMISSIONS ======
    const hasPermission = useCallback(
        (perm) => {
            if (!state.user) return false;
            return PERMISSIONS[state.user.role]?.[perm] ?? false;
        },
        [state.user]
    );

    // ====== CUSTOMERS ======
    const addCustomer = useCallback(async (data) => {
        const result = await api('/customers', { method: 'POST', body: data });
        dispatch({ type: 'ADD_CUSTOMER', payload: result });
        return result;
    }, []);

    const updateCustomer = useCallback(async (data) => {
        const result = await api(`/customers/${data.id}`, { method: 'PUT', body: data });
        dispatch({ type: 'UPDATE_CUSTOMER', payload: result });
        return result;
    }, []);

    const deleteCustomer = useCallback(async (id) => {
        await api(`/customers/${id}`, { method: 'DELETE' });
        dispatch({ type: 'DELETE_CUSTOMER', payload: id });
    }, []);

    // ====== PRODUCTS ======
    const addProduct = useCallback(async (data) => {
        const result = await api('/products', { method: 'POST', body: data });
        dispatch({ type: 'ADD_PRODUCT', payload: result });
        return result;
    }, []);

    const updateProduct = useCallback(async (data) => {
        const result = await api(`/products/${data.id}`, { method: 'PUT', body: data });
        dispatch({ type: 'UPDATE_PRODUCT', payload: result });
        return result;
    }, []);

    const deleteProduct = useCallback(async (id) => {
        await api(`/products/${id}`, { method: 'DELETE' });
        dispatch({ type: 'DELETE_PRODUCT', payload: id });
    }, []);

    // ====== ORDERS ======
    const addOrder = useCallback(async (data) => {
        const result = await api('/orders', { method: 'POST', body: data });
        dispatch({ type: 'ADD_ORDER', payload: result });
        return result;
    }, []);

    const updateOrder = useCallback(async (id, data) => {
        await api(`/orders/${id}`, { method: 'PUT', body: data });
        dispatch({ type: 'UPDATE_ORDER', payload: { id, ...data } });
    }, []);

    // ====== LEDGER ======
    const addLedgerEntry = useCallback(async (data) => {
        const result = await api('/ledger', { method: 'POST', body: data });
        dispatch({ type: 'ADD_LEDGER_ENTRY', payload: result });
        return result;
    }, []);

    const deleteLedgerEntry = useCallback(async (id) => {
        await api(`/ledger/${id}`, { method: 'DELETE' });
        dispatch({ type: 'DELETE_LEDGER_ENTRY', payload: id });
    }, []);

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
        dispatch,
        login,
        logout,
        hasPermission,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addProduct,
        updateProduct,
        deleteProduct,
        addOrder,
        updateOrder,
        addLedgerEntry,
        deleteLedgerEntry,
        getCustomerById,
        getProductById,
        getOrdersForCustomer,
        refreshData: loadAllData,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within an AppProvider');
    return context;
}
