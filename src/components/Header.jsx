import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { FiMenu } from 'react-icons/fi';

const PAGE_TITLES = {
    '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your business' },
    '/customers': { title: 'Customers', subtitle: 'Manage your customers' },
    '/products': { title: 'Products', subtitle: 'Manage inventory & stock' },
    '/orders': { title: 'Orders', subtitle: 'View and create orders' },
    '/tracking': { title: 'Tracking', subtitle: 'Manage shipment tracking' },
    '/ledger': { title: 'Ledger', subtitle: 'Income & expense tracking' },
    '/reports': { title: 'Reports', subtitle: 'Sales & profit reports' },
};

export default function Header() {
    const { dispatch } = useApp();
    const location = useLocation();

    const pageInfo = PAGE_TITLES[location.pathname] || {
        title: 'SNAH',
        subtitle: 'Inventory Management',
    };

    return (
        <header className="header">
            <div className="header-left">
                <button
                    className="mobile-menu-btn"
                    onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                    id="mobile-menu-toggle"
                >
                    <FiMenu size={22} />
                </button>
                <div className="header-title">
                    <h1>{pageInfo.title}</h1>
                    <p>{pageInfo.subtitle}</p>
                </div>
            </div>
            <div className="header-right">
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                    {new Date().toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    })}
                </span>
            </div>
        </header>
    );
}
