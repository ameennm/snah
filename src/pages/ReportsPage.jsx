import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FiTrendingUp, FiDollarSign, FiShoppingBag, FiCalendar } from 'react-icons/fi';

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
        default:
            from = new Date(0);
            to = new Date(today.getTime() + 86400000);
    }
    return { from, to };
}

export default function ReportsPage() {
    const { orders, products, getProductById } = useApp();

    const [period, setPeriod] = useState('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const { from, to } = useMemo(
        () => getDateRange(period, customFrom, customTo),
        [period, customFrom, customTo]
    );

    const filteredOrders = useMemo(
        () => orders.filter((o) => {
            const d = new Date(o.createdAt);
            return d >= from && d < to;
        }),
        [orders, from, to]
    );

    // Overall calculations
    const totalSales = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const totalGst = filteredOrders.reduce((sum, o) => sum + o.gstAmount, 0);
    const totalCost = filteredOrders.reduce((sum, o) => {
        return sum + o.items.reduce((itemSum, item) => {
            const product = getProductById(item.productId);
            return itemSum + (product ? product.purchasePrice * item.quantity : 0);
        }, 0);
    }, 0);
    const totalProfit = totalSales - totalGst - totalCost;

    // Product-wise profit
    const productProfitMap = {};
    filteredOrders.forEach((o) => {
        o.items.forEach((item) => {
            const product = getProductById(item.productId);
            if (!product) return;
            if (!productProfitMap[item.productId]) {
                productProfitMap[item.productId] = {
                    name: product.name,
                    unitsSold: 0,
                    revenue: 0,
                    cost: 0,
                    gst: 0,
                    stock: product.stock,
                };
            }
            const lineTotal = item.price * item.quantity;
            const lineGst = (lineTotal * item.gst) / 100;
            productProfitMap[item.productId].unitsSold += item.quantity;
            productProfitMap[item.productId].revenue += lineTotal;
            productProfitMap[item.productId].cost += product.purchasePrice * item.quantity;
            productProfitMap[item.productId].gst += lineGst;
        });
    });

    const productProfits = Object.values(productProfitMap)
        .map((p) => ({ ...p, profit: p.revenue - p.cost }))
        .sort((a, b) => b.profit - a.profit);

    // All products performance (including zero sales)
    const allProductPerf = products.map((product) => {
        const perf = productProfitMap[product.id];
        return {
            id: product.id,
            name: product.name,
            unitsSold: perf ? perf.unitsSold : 0,
            revenue: perf ? perf.revenue : 0,
            cost: perf ? perf.cost : 0,
            profit: perf ? perf.revenue - perf.cost : 0,
            stock: product.stock,
        };
    });

    const topPerformers = [...allProductPerf].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    const lowPerformers = [...allProductPerf].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);

    // Monthly breakdown
    const monthlyData = {};
    filteredOrders.forEach((o) => {
        const month = new Date(o.createdAt).toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric',
        });
        if (!monthlyData[month]) {
            monthlyData[month] = { sales: 0, cost: 0, gst: 0, orders: 0 };
        }
        monthlyData[month].sales += o.total;
        monthlyData[month].gst += o.gstAmount;
        monthlyData[month].orders += 1;
        o.items.forEach((item) => {
            const product = getProductById(item.productId);
            if (product) {
                monthlyData[month].cost += product.purchasePrice * item.quantity;
            }
        });
    });

    // Payment status breakdown
    const paymentBreakdown = {
        paid: filteredOrders.filter((o) => o.paymentStatus === 'paid'),
        not_paid: filteredOrders.filter((o) => o.paymentStatus === 'not_paid'),
        partial: filteredOrders.filter((o) => o.paymentStatus === 'partial'),
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
            <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
                <div className="filters-row" style={{ alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                        <FiCalendar /> Period:
                    </div>
                    {['all', 'today', 'week', 'month', 'custom'].map((p) => (
                        <button
                            key={p}
                            className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setPeriod(p)}
                        >
                            {periodLabel[p]}
                        </button>
                    ))}
                    {period === 'custom' && (
                        <>
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
                        </>
                    )}
                </div>
            </div>

            {/* Profit Summary Cards */}
            <div className="profit-summary">
                <div className="profit-card sales">
                    <h3>
                        <FiDollarSign style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Total Sales
                    </h3>
                    <div className="amount">{formatCurrency(totalSales)}</div>
                </div>
                <div className="profit-card cost">
                    <h3>
                        <FiShoppingBag style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Total Cost
                    </h3>
                    <div className="amount">{formatCurrency(totalCost)}</div>
                </div>
                <div className="profit-card profit">
                    <h3>
                        <FiTrendingUp style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Net Profit
                    </h3>
                    <div className="amount" style={{ color: totalProfit >= 0 ? 'var(--success-600)' : 'var(--danger-600)' }}>
                        {formatCurrency(totalProfit)}
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Product Profit Report */}
                <div className="card full-width">
                    <div className="card-header">
                        <h2>Product-wise Profit Report</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Units Sold</th>
                                    <th>Revenue</th>
                                    <th>Cost</th>
                                    <th>GST Collected</th>
                                    <th>Profit</th>
                                    <th>Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productProfits.map((p, i) => (
                                    <tr key={i}>
                                        <td className="font-bold">{p.name}</td>
                                        <td>{p.unitsSold}</td>
                                        <td>{formatCurrency(p.revenue)}</td>
                                        <td>{formatCurrency(p.cost)}</td>
                                        <td>{formatCurrency(p.gst)}</td>
                                        <td className={p.profit >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                                            {formatCurrency(p.profit)}
                                        </td>
                                        <td>
                                            <span className={`badge ${p.profit >= 0 ? 'badge-in-stock' : 'badge-low-stock'}`}>
                                                {p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : 0}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {productProfits.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center text-muted" style={{ padding: '40px' }}>
                                            No sales data for this period
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Performers */}
                <div className="card">
                    <div className="card-header">
                        <h2>🏆 Top Performers</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product</th>
                                    <th>Sold</th>
                                    <th>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topPerformers.map((p, i) => (
                                    <tr key={p.id}>
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
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Low Performers */}
                <div className="card">
                    <div className="card-header">
                        <h2>📉 Low Performers</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Sold</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowPerformers.map((p) => (
                                    <tr key={p.id}>
                                        <td className="font-bold">{p.name}</td>
                                        <td>{p.unitsSold}</td>
                                        <td>
                                            <span className={`badge ${p.stock <= 10 ? 'badge-low-stock' : 'badge-in-stock'}`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td>
                                            {p.unitsSold === 0 ? (
                                                <span className="badge badge-unpaid">No Sales</span>
                                            ) : p.unitsSold <= 2 ? (
                                                <span className="badge badge-partial">Slow</span>
                                            ) : (
                                                <span className="badge badge-pending">Average</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Monthly Summary */}
                <div className="card">
                    <div className="card-header">
                        <h2>Monthly Summary</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Orders</th>
                                    <th>Sales</th>
                                    <th>Cost</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(monthlyData).map(([month, data]) => {
                                    const profit = data.sales - data.gst - data.cost;
                                    return (
                                        <tr key={month}>
                                            <td className="font-bold">{month}</td>
                                            <td>{data.orders}</td>
                                            <td>{formatCurrency(data.sales)}</td>
                                            <td>{formatCurrency(data.cost)}</td>
                                            <td className={profit >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                                                {formatCurrency(profit)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {Object.keys(monthlyData).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center text-muted" style={{ padding: '40px' }}>
                                            No data for this period
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payment Status */}
                <div className="card">
                    <div className="card-header">
                        <h2>Payment Status</h2>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-8">
                                    <span className="badge badge-paid">Paid</span>
                                    <span style={{ fontSize: '0.875rem' }}>{paymentBreakdown.paid.length} orders</span>
                                </div>
                                <span className="font-bold">
                                    {formatCurrency(paymentBreakdown.paid.reduce((s, o) => s + o.total, 0))}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-8">
                                    <span className="badge badge-partial">Partial</span>
                                    <span style={{ fontSize: '0.875rem' }}>{paymentBreakdown.partial.length} orders</span>
                                </div>
                                <span className="font-bold">
                                    {formatCurrency(paymentBreakdown.partial.reduce((s, o) => s + o.total, 0))}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-8">
                                    <span className="badge badge-unpaid">Not Paid</span>
                                    <span style={{ fontSize: '0.875rem' }}>{paymentBreakdown.not_paid.length} orders</span>
                                </div>
                                <span className="font-bold text-danger">
                                    {formatCurrency(paymentBreakdown.not_paid.reduce((s, o) => s + o.total, 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
