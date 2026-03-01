import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
    FiGrid,
    FiUsers,
    FiPackage,
    FiShoppingCart,
    FiTruck,
    FiBarChart2,
    FiBookOpen,
    FiLogOut,
    FiX,
} from 'react-icons/fi';

const NAV_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: FiGrid, permission: 'dashboard' },
    { path: '/customers', label: 'Customers', icon: FiUsers, permission: 'customers' },
    { path: '/products', label: 'Products', icon: FiPackage, permission: 'products' },
    { path: '/orders', label: 'Orders', icon: FiShoppingCart, permission: 'orders' },
    { path: '/tracking', label: 'Tracking', icon: FiTruck, permission: 'tracking' },
    { path: '/ledger', label: 'Ledger', icon: FiBookOpen, permission: 'ledger' },
    { path: '/reports', label: 'Reports', icon: FiBarChart2, permission: 'reports' },
];

export default function Sidebar() {
    const { user, sidebarOpen, dispatch, logout, hasPermission } = useApp();
    const location = useLocation();

    const closeSidebar = () => dispatch({ type: 'CLOSE_SIDEBAR' });

    return (
        <>
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
                onClick={closeSidebar}
            />
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">S</div>
                    <div className="sidebar-brand">
                        <h2>SNAH</h2>
                        <span>Inventory Manager</span>
                    </div>
                    <button
                        className="modal-close"
                        onClick={closeSidebar}
                        style={{ display: sidebarOpen ? 'flex' : 'none', marginLeft: 'auto' }}
                    >
                        <FiX />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">Menu</div>
                    {NAV_ITEMS.map((item) => {
                        if (!hasPermission(item.permission)) return null;
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-item ${isActive ? 'active' : ''}`
                                }
                                onClick={closeSidebar}
                            >
                                <Icon className="nav-icon" />
                                {item.label}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name}</div>
                            <div className="sidebar-user-role">{user?.roleLabel}</div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={logout}>
                        <FiLogOut />
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
}
