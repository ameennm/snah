import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
    FiGrid, FiUsers, FiPackage, FiShoppingCart, FiTruck, FiBarChart2,
    FiBookOpen, FiLogOut, FiX, FiSettings, FiHelpCircle,
    FiPhone, FiPhoneMissed, FiTarget, FiPieChart, FiMessageSquare, FiList
} from 'react-icons/fi';

const NAV_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: FiGrid, permission: 'dashboard' },
    { path: '/customers', label: 'Customers', icon: FiUsers, permission: 'customers' },
    { path: '/products', label: 'Products', icon: FiPackage, permission: 'products' },
    { path: '/orders', label: 'Orders', icon: FiShoppingCart, permission: 'orders' },
    { path: '/followups', label: 'Followups', icon: FiMessageSquare, permission: 'followups' },
    { path: '/employees', label: 'Employees', icon: FiUsers, permission: 'createEmployee' },
    { path: '/tracking', label: 'Tracking', icon: FiTruck, permission: 'tracking' },
    { path: '/ledger', label: 'Ledger', icon: FiBookOpen, permission: 'ledger' },
    { path: '/reports', label: 'Reports', icon: FiBarChart2, permission: 'reports' },
    { path: '/delivery-partners', label: 'Delivery Partners', icon: FiTruck, permission: 'deliveryPartners' },
    { path: '/activity-logs', label: 'Activity Logs', icon: FiList, adminOnly: true },
];

const MORE_NAV_ITEMS = [
    { path: '/tracking', label: 'Tracking', icon: FiTruck, permission: 'tracking' },
    { path: '/ledger', label: 'Ledger', icon: FiBookOpen, permission: 'ledger' },
    { path: '/reports', label: 'Reports', icon: FiBarChart2, permission: 'reports' },
];

export default function Sidebar() {
    const { user, sidebarOpen, dispatch, logout, hasPermission, crmLeads } = useApp();

    const closeSidebar = () => dispatch({ type: 'CLOSE_SIDEBAR' });

    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    const leads = crmLeads || [];
    const crmPendingCount = leads.filter(l => l.payment_status === 'pending' && l.status !== 'not-interested').length;
    const crmTodayCount = leads.filter(l => l.next_call_date && new Date(l.next_call_date).setHours(0, 0, 0, 0) === todayMidnight && l.status !== 'not-interested').length;
    const crmOverdueCount = leads.filter(l => l.next_call_date && new Date(l.next_call_date).setHours(0, 0, 0, 0) < todayMidnight && l.status !== 'not-interested').length;
    const crmPassedInCount = leads.filter(l => l.is_passed && l.assigned_to === user?.id).length;

    const CRM_NAV = [
        { path: '/crm/dashboard', label: 'CRM Overview', icon: FiPieChart },
        { path: '/crm/leads', label: 'Leads', icon: FiTarget, badge: crmPassedInCount || crmPendingCount || null, badgeColor: crmPassedInCount ? 'red' : 'orange' },
        { path: '/crm/reminders', label: 'Reminders', icon: FiPhone, badge: crmTodayCount || null, badgeColor: 'cyan' },
        { path: '/crm/missed', label: 'Missed Calls', icon: FiPhoneMissed, badge: crmOverdueCount || null, badgeColor: 'red' },
        { path: '/crm/messages', label: 'Messages', icon: FiMessageSquare },
    ];

    return (
        <>
            {/* Desktop Overlay */}
            <div className={`sidebar-overlay desktop-only ${sidebarOpen ? 'show' : ''}`} onClick={closeSidebar} />

            {/* Desktop Sidebar */}
            <aside className={`sidebar desktop-only ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">S</div>
                    <div className="sidebar-brand">
                        <h2>SNAH</h2>
                        <span>Inventory Manager</span>
                    </div>
                    <button className="modal-close" onClick={closeSidebar} style={{ display: sidebarOpen ? 'flex' : 'none', marginLeft: 'auto' }}>
                        <FiX />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">Menu</div>
                    {NAV_ITEMS.map((item) => {
                        if (item.adminOnly && user?.role !== 'super_admin') return null;
                        if (item.permission && !hasPermission(item.permission)) return null;
                        const Icon = item.icon;
                        return (
                            <NavLink key={item.path} to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                onClick={closeSidebar}>
                                <Icon className="nav-icon" />
                                {item.label}
                            </NavLink>
                        );
                    })}

                    {hasPermission('crm') && (
                        <>
                            <div className="sidebar-section-title" style={{ marginTop: '1.25rem' }}>CRM</div>
                            {CRM_NAV.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <NavLink key={item.path} to={item.path}
                                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                        onClick={closeSidebar}>
                                        <Icon className="nav-icon" />
                                        {item.label}
                                        {item.badge ? <span className={`crm-nav-badge crm-nav-badge-${item.badgeColor}`}>{item.badge}</span> : null}
                                    </NavLink>
                                );
                            })}
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">{user?.role === 'super_admin' ? 'S' : user?.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.role === 'super_admin' ? 'Super Admin' : user?.name}</div>
                            {user?.role !== 'super_admin' && <div className="sidebar-user-role">{user?.roleLabel}</div>}
                        </div>
                    </div>
                    <button className="logout-btn" onClick={logout}>
                        <FiLogOut /> Logout
                    </button>
                </div>
            </aside>

            {/* Mobile Drawer Overlay */}
            <div className={`drawer-overlay mobile-only ${sidebarOpen ? 'show' : ''}`} onClick={closeSidebar} />

            {/* Mobile Drawer */}
            <div className={`drawer mobile-only ${sidebarOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <div className="drawer-user">
                        <div className="avatar">{user?.role === 'super_admin' ? 'S' : user?.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="user-info">
                            <span className="name">{user?.role === 'super_admin' ? 'Super Admin' : user?.name}</span>
                            {user?.role !== 'super_admin' && <span className="role">{user?.roleLabel}</span>}
                        </div>
                    </div>
                    <button className="icon-btn close-btn" onClick={closeSidebar}><FiX size={24} /></button>
                </div>

                <div className="drawer-content">
                    <div className="drawer-section">
                        <div className="section-title">More Services</div>
                        {MORE_NAV_ITEMS.map((item) => {
                            if (!hasPermission(item.permission)) return null;
                            const Icon = item.icon;
                            return (
                                <NavLink key={item.path} to={item.path} className="drawer-item" onClick={closeSidebar}>
                                    <Icon size={20} className="icon" />
                                    <span>{item.label}</span>
                                </NavLink>
                            );
                        })}
                    </div>

                    {hasPermission('crm') && (
                        <div className="drawer-section">
                            <div className="section-title">CRM</div>
                            {CRM_NAV.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <NavLink key={item.path} to={item.path} className="drawer-item" onClick={closeSidebar}>
                                        <Icon size={20} className="icon" />
                                        <span>{item.label}</span>
                                        {item.badge ? <span className={`crm - nav - badge crm - nav - badge - ${item.badgeColor} `} style={{ marginLeft: 'auto' }}>{item.badge}</span> : null}
                                    </NavLink>
                                );
                            })}
                        </div>
                    )}

                    <div className="drawer-section">
                        <div className="section-title">Account</div>
                        <button className="drawer-item" onClick={closeSidebar}>
                            <FiSettings size={20} className="icon" /><span>Settings</span>
                        </button>
                        <button className="drawer-item" onClick={closeSidebar}>
                            <FiHelpCircle size={20} className="icon" /><span>Help & Support</span>
                        </button>
                        <button className="drawer-item logout" onClick={logout}>
                            <FiLogOut size={20} className="icon" /><span>Log Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
