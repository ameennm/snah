import { useApp } from '../context/AppContext';
import { FiTrendingUp, FiDollarSign, FiShoppingBag } from 'react-icons/fi';

export default function ReportsPage() {
    const { orders, products, getProductById } = useApp();

    // Overall calculations
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalGst = orders.reduce((sum, o) => sum + o.gstAmount, 0);
    const totalCost = orders.reduce((sum, o) => {
        return sum + o.items.reduce((itemSum, item) => {
            const product = getProductById(item.productId);
            return itemSum + (product ? product.purchasePrice * item.quantity : 0);
        }, 0);
    }, 0);
    const totalProfit = totalSales - totalGst - totalCost;

    // Product-wise profit
    const productProfitMap = {};
    orders.forEach((o) => {
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

    // Monthly breakdown
    const monthlyData = {};
    orders.forEach((o) => {
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
        paid: orders.filter((o) => o.paymentStatus === 'paid'),
        not_paid: orders.filter((o) => o.paymentStatus === 'not_paid'),
        partial: orders.filter((o) => o.paymentStatus === 'partial'),
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <>
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
                                            No sales data available
                                        </td>
                                    </tr>
                                )}
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
