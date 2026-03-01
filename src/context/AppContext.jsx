import { createContext, useContext, useReducer, useCallback } from 'react';
import {
    USERS,
    INITIAL_CUSTOMERS,
    INITIAL_PRODUCTS,
    INITIAL_ORDERS,
    INITIAL_LEDGER,
    PERMISSIONS,
} from '../data/mockData';

const AppContext = createContext();

const initialState = {
    user: null,
    customers: INITIAL_CUSTOMERS,
    products: INITIAL_PRODUCTS,
    orders: INITIAL_ORDERS,
    ledger: INITIAL_LEDGER,
    sidebarOpen: false,
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

        // Customers
        case 'ADD_CUSTOMER':
            return {
                ...state,
                customers: [
                    ...state.customers,
                    { ...action.payload, id: Math.max(0, ...state.customers.map((c) => c.id)) + 1 },
                ],
            };
        case 'UPDATE_CUSTOMER':
            return {
                ...state,
                customers: state.customers.map((c) =>
                    c.id === action.payload.id ? action.payload : c
                ),
            };
        case 'DELETE_CUSTOMER':
            return {
                ...state,
                customers: state.customers.filter((c) => c.id !== action.payload),
            };

        // Products
        case 'ADD_PRODUCT':
            return {
                ...state,
                products: [
                    ...state.products,
                    { ...action.payload, id: Math.max(0, ...state.products.map((p) => p.id)) + 1 },
                ],
            };
        case 'UPDATE_PRODUCT':
            return {
                ...state,
                products: state.products.map((p) =>
                    p.id === action.payload.id ? action.payload : p
                ),
            };
        case 'DELETE_PRODUCT':
            return {
                ...state,
                products: state.products.filter((p) => p.id !== action.payload),
            };

        // Orders
        case 'ADD_ORDER': {
            const order = action.payload;
            // Reduce stock
            const updatedProducts = state.products.map((p) => {
                const item = order.items.find((i) => i.productId === p.id);
                if (item) {
                    return { ...p, stock: p.stock - item.quantity };
                }
                return p;
            });
            const nextId = state.orders.length + 1;
            const orderId = `ORD-${String(nextId).padStart(3, '0')}`;
            return {
                ...state,
                orders: [...state.orders, { ...order, id: orderId }],
                products: updatedProducts,
            };
        }
        case 'UPDATE_ORDER':
            return {
                ...state,
                orders: state.orders.map((o) =>
                    o.id === action.payload.id ? { ...o, ...action.payload } : o
                ),
            };
        case 'UPDATE_TRACKING':
            return {
                ...state,
                orders: state.orders.map((o) =>
                    o.id === action.payload.orderId
                        ? { ...o, trackingId: action.payload.trackingId, status: 'shipped' }
                        : o
                ),
            };

        // Ledger
        case 'ADD_LEDGER_ENTRY':
            return {
                ...state,
                ledger: [
                    ...state.ledger,
                    { ...action.payload, id: Math.max(0, ...state.ledger.map((l) => l.id)) + 1 },
                ],
            };
        case 'DELETE_LEDGER_ENTRY':
            return {
                ...state,
                ledger: state.ledger.filter((l) => l.id !== action.payload),
            };

        default:
            return state;
    }
}

export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    const login = useCallback((username, password) => {
        const user = USERS.find(
            (u) => u.username === username && u.password === password
        );
        if (user) {
            dispatch({ type: 'LOGIN', payload: user });
            return { success: true };
        }
        return { success: false, error: 'Invalid username or password' };
    }, []);

    const logout = useCallback(() => {
        dispatch({ type: 'LOGOUT' });
    }, []);

    const hasPermission = useCallback(
        (perm) => {
            if (!state.user) return false;
            return PERMISSIONS[state.user.role]?.[perm] ?? false;
        },
        [state.user]
    );

    const getCustomerById = useCallback(
        (id) => state.customers.find((c) => c.id === id),
        [state.customers]
    );

    const getProductById = useCallback(
        (id) => state.products.find((p) => p.id === id),
        [state.products]
    );

    const getOrdersForCustomer = useCallback(
        (customerId) => state.orders.filter((o) => o.customerId === customerId),
        [state.orders]
    );

    const value = {
        ...state,
        dispatch,
        login,
        logout,
        hasPermission,
        getCustomerById,
        getProductById,
        getOrdersForCustomer,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
