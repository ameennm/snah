import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
    FiGrid,
    FiUsers,
    FiPackage,
    FiShoppingCart,
    FiMenu
} from 'react-icons/fi';

export default function BottomNav() {
    const { user, hasPermission, dispatch, crmLeads } = useApp();
    const crmLeadsList = crmLeads || [];
    const crmPassedInCount = crmLeadsList.filter(l => l.is_passed && l.assigned_to === user?.id).length;

    const openSidebar = () => dispatch({ type: 'TOGGLE_SIDEBAR' });

    // 4 primary items + Menu
    const primaryNav = [
        { path: '/dashboard', label: 'Home', icon: FiGrid, permission: 'dashboard' },
        { path: '/customers', label: 'Clients', icon: FiUsers, permission: 'customers' },
        { path: '/products', label: 'Stock', icon: FiPackage, permission: 'products' },
        { path: '/orders', label: 'Orders', icon: FiShoppingCart, permission: 'orders' }
    ].filter(item => hasPermission(item.permission));

    return (
        <nav className="bottom-nav mobile-only">
            {primaryNav.map((item) => {
                const Icon = item.icon;
                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Icon className="bottom-nav-icon" />
                        <span>{item.label}</span>
                    </NavLink>
                );
            })}

            <button className="bottom-nav-item" onClick={openSidebar} style={{ position: 'relative' }}>
                <FiMenu className="bottom-nav-icon" />
                <span>More</span>
                {crmPassedInCount > 0 && (
                    <span style={{ position: 'absolute', top: '8px', right: '25%', width: '8px', height: '8px', background: 'var(--danger-500)', borderRadius: '50%', border: '2px solid white' }} />
                )}
            </button>
        </nav>
    );
}
