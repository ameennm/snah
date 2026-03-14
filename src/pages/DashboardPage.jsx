import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    FiShoppingCart,
    FiDollarSign,
    FiTrendingUp,
    FiPackage,
    FiAlertTriangle,
    FiCalendar,
} from 'react-icons/fi';

// Date range helper
function getDateRange(period, customFrom, customTo) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from, to;

    switch (period) {
        case 'today':
            from = today;
            to = new Date(today.getTime() + 86400000);
            break;
        case 'week': {
            const dayOfWeek = today.getDay();
            from = new Date(today.getTime() - dayOfWeek * 86400000);
            to = new Date(today.getTime() + 86400000);
            break;
        }
        case 'month':
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            to = new Date(today.getTime() + 86400000);
            break;
        case 'custom':
            from = customFrom ? new Date(customFrom) : new Date(0);
            to = customTo ? new Date(new Date(customTo).getTime() + 86400000) : new Date(today.getTime() + 86400000);
            break;
        default: // 'all'
            from = new Date(0);
            to = new Date(today.getTime() + 86400000);
    }
    return { from, to };
}

export default function DashboardPage() {
    const { orders, customers, getCustomerById, api, products } = useApp();

    // Date filter state
    const [period, setPeriod] = useState('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalSales: 0,
        totalExpenses: 0,
        totalProducts: 0,
        lowStockCount: 0,
        productPerformance: []
    });

    const { from, to } = useMemo(
        () => getDateRange(period, customFrom, customTo),
        [period, customFrom, customTo]
    );

    useEffect(() => {
        setLoading(true);
        let qs = `?period=${period}`;
        if (period !== 'all') {
            qs += `&from=${from.toISOString()}&to=${to.toISOString()}`;
        }
        api(`/dashboard-stats${qs}`)
            .then(data => {
                setStats(data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [period, from, to, api]);

    const totalProfit = stats.totalSales - stats.totalExpenses;

    // Process top sellers for the UI
    const productPerformance = useMemo(() => {
        const perf = stats.productPerformance || [];
        // Map product IDs to product names. The API relies on the frontend `products` or DB names, 
        // actually the API just returns productId, soldQuantity, and revenue. Let's hydrate names from context or map. 
        // We will just fetch products locally since we still load the `products` list in AppContext.
        return {
            topSellers: [...perf].sort((a, b) => b.soldQuantity - a.soldQuantity),
            topRevenue: [...perf].sort((a, b) => b.revenue - a.revenue),
            lowPerformers: [...perf].sort((a, b) => a.soldQuantity - b.soldQuantity),
        };
    }, [stats.productPerformance]);

    // Recent orders just uses whatever 20 orders we already have locally, 
    // since we only display 5. No need to query back to server.
    const recentOrders = useMemo(() => {
        return [...orders]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);
    }, [orders]);

    const formatCurrency = (val) =>
        '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getPaymentBadge = (status) => {
        const map = {
            paid: 'badge-paid',
            not_paid: 'badge-unpaid',
            partial: 'badge-partial',
        };
        const labels = { paid: 'Paid', not_paid: 'Not Paid', partial: 'Partial' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    const periodLabel = {
        all: 'All Time',
        today: 'Today',
        week: 'This Week',
        month: 'This Month',
        custom: 'Custom Range',
    };

    return (
        <>
            {/* Date Range Filter */}
            <div
                className="card"
                style={{ marginBottom: '20px', padding: '16px 20px' }}
            >
                <div className="filters-row" style={{ alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                        <FiCalendar /> Period:
                    </div>
                    {/* Desktop View Buttons */}
                    <div className="desktop-period-selector" style={{ display: 'flex', gap: '8px' }}>
                        {['all', 'today', 'week', 'month', 'custom'].map((p) => (
                            <button
                                key={p}
                                className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setPeriod(p)}
                            >
                                {periodLabel[p]}
                            </button>
                        ))}
                    </div>

                    {/* Mobile View Dropdown */}
                    <div className="mobile-period-selector">
                        <select
                            className="status-select"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            style={{ width: '100%', padding: '10px 16px', fontSize: '1rem', background: 'var(--bg-surface)' }}
                        >
                            {['all', 'today', 'week', 'month', 'custom'].map((p) => (
                                <option key={p} value={p}>
                                    {periodLabel[p]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {period === 'custom' && (
                        <div className="custom-date-inputs">
                            <div className="form-group" style={{ margin: 0, maxWidth: '160px' }}>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
                                />
                            </div>
                            <span style={{ color: 'var(--text-tertiary)' }}>to</span>
                            <div className="form-group" style={{ margin: 0, maxWidth: '160px' }}>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    style={{ padding: '6px 10px', fontSize: '0.8125rem' }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading Dashboard...</div>
            ) : (
                <>
                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon blue">
                            <FiShoppingCart />
                        </div>
                        <div className="stat-info">
                            <div className="stat-label">Total Orders</div>
                            <div className="stat-value">{stats.totalOrders}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon green">
                            <FiDollarSign />
                        </div>
                        <div className="stat-info">
                            <div className="stat-label">Total Sales</div>
                            <div className="stat-value">{formatCurrency(stats.totalSales)}</div>
                        </div>
                    </div>

                <div className="stat-card">
                    <div className="stat-icon yellow">
                        <FiTrendingUp />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Profit</div>
                        <div className="stat-value">{formatCurrency(totalProfit)}</div>
                        <div className={`stat-change ${totalProfit >= 0 ? 'up' : 'down'}`}>
                            {totalProfit >= 0 ? '↑' : '↓'} Profit Based on Ledger
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon red">
                        <FiPackage />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Products</div>
                        <div className="stat-value">{stats.totalProducts}</div>
                        {stats.lowStockCount > 0 && (
                            <div className="stat-change down">
                                <FiAlertTriangle size={12} /> {stats.lowStockCount} low stock
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="dashboard-grid">
                {/* Top Selling Products */}
                <div className="card">
                    <div className="card-header">
                        <h2>🏆 Top Selling Products</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product</th>
                                    <th>Units Sold</th>
                                    <th>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productPerformance.topSellers.slice(0, 5).map((p, i) => (
                                    <tr key={p.productId || i}>
                                        <td>
                                            <span style={{
                                                background: i === 0 ? 'var(--warning-500)' : i === 1 ? 'var(--gray-400)' : i === 2 ? '#cd7f32' : 'var(--gray-200)',
                                                color: i < 3 ? 'white' : 'var(--text-secondary)',
                                                width: '24px', height: '24px', borderRadius: '50%',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.75rem', fontWeight: 700,
                                            }}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="font-bold">{p.name}</td>
                                        <td>{p.unitsSold}</td>
                                        <td>{formatCurrency(p.revenue)}</td>
                                    </tr>
                                ))}
                                {productPerformance.topSellers.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center text-muted">
                                            No sales data for this period
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Low Performance Products */}
                <div className="card">
                    <div className="card-header">
                        <h2>📉 Low Performance Products</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Units Sold</th>
                                    <th>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Show products with fewest sales */}
                                {productPerformance.lowPerformers
                                    .slice(0, 5)
                                    .map((p) => {
                                        const product = useApp().products.find(prod => prod.id === p.productId) || { name: 'Unknown', stock: 0 };
                                        return (
                                            <tr key={p.productId}>
                                                <td className="font-bold">{product.name}</td>
                                                <td>{p.soldQuantity}</td>
                                                <td>{formatCurrency(p.revenue)}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>

                    </div>
                </div>

                {/* Recent Orders */}
                <div className="card">
                    <div className="card-header">
                        <h2>Recent Orders</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer</th>
                                    <th>Total</th>
                                    <th>Payment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((order) => {
                                    const customer = getCustomerById(order.customerId);
                                    return (
                                        <tr key={order.id}>
                                            <td className="font-mono">{order.id}</td>
                                            <td>{customer?.name || 'Unknown'}</td>
                                            <td className="font-bold">{formatCurrency(order.total)}</td>
                                            <td>{getPaymentBadge(order.paymentStatus)}</td>
                                        </tr>
                                    );
                                })}
                                {recentOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center text-muted">
                                            No orders in this period
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Low Stock Alert */}
                <div className="card">
                    <div className="card-header">
                        <h2>⚠️ Low Stock Alert</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Stock</th>
                                    <th>Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Low Stock Alert Table logic replaced by backend simple count, if needed we can fetch low stock products separately. For now just show active generic products to prevent errors. */}
                                {useApp().products.filter(p => p.stock <= 10).map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.name}</td>
                                        <td>
                                            <span className="badge badge-low-stock">{p.stock} left</span>
                                        </td>
                                        <td>{formatCurrency(p.sellingPrice)}</td>
                                    </tr>
                                ))}
                                {stats.lowStockCount === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center text-muted">
                                            All products are well-stocked
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            </>
            )}
        </>
    );
}
