import { useApp } from '../context/AppContext';
import {
    FiShoppingCart,
    FiDollarSign,
    FiTrendingUp,
    FiPackage,
    FiAlertTriangle,
} from 'react-icons/fi';

export default function DashboardPage() {
    const { orders, products, customers, getCustomerById, getProductById } = useApp();

    // Calculations
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalCost = orders.reduce((sum, o) => {
        return sum + o.items.reduce((itemSum, item) => {
            const product = getProductById(item.productId);
            return itemSum + (product ? product.purchasePrice * item.quantity : 0);
        }, 0);
    }, 0);
    const totalProfit = totalSales - totalCost;
    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => p.stock <= 10);

    // Top selling products
    const productSales = {};
    orders.forEach((o) => {
        o.items.forEach((item) => {
            productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
        });
    });
    const topProducts = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, qty]) => ({ product: getProductById(Number(id)), quantity: qty }));

    // Recent orders
    const recentOrders = [...orders]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    // Monthly summary from orders
    const monthlySales = {};
    orders.forEach((o) => {
        const month = new Date(o.createdAt).toLocaleDateString('en-IN', {
            month: 'short',
            year: 'numeric',
        });
        monthlySales[month] = (monthlySales[month] || 0) + o.total;
    });

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getPaymentBadge = (status) => {
        const map = {
            paid: 'badge-paid',
            not_paid: 'badge-unpaid',
            partial: 'badge-partial',
        };
        const labels = { paid: 'Paid', not_paid: 'Not Paid', partial: 'Partial' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    return (
        <>
            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <FiShoppingCart />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Orders</div>
                        <div className="stat-value">{totalOrders}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon green">
                        <FiDollarSign />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Sales</div>
                        <div className="stat-value">{formatCurrency(totalSales)}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon yellow">
                        <FiTrendingUp />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Profit</div>
                        <div className="stat-value">{formatCurrency(totalProfit)}</div>
                        <div className="stat-change up">
                            ↑ {((totalProfit / (totalSales || 1)) * 100).toFixed(1)}% margin
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon red">
                        <FiPackage />
                    </div>
                    <div className="stat-info">
                        <div className="stat-label">Total Products</div>
                        <div className="stat-value">{totalProducts}</div>
                        {lowStockProducts.length > 0 && (
                            <div className="stat-change down">
                                <FiAlertTriangle size={12} /> {lowStockProducts.length} low stock
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="dashboard-grid">
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
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Products */}
                <div className="card">
                    <div className="card-header">
                        <h2>Top Selling Products</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Units Sold</th>
                                    <th>Stock Left</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.map(({ product, quantity }) =>
                                    product ? (
                                        <tr key={product.id}>
                                            <td>{product.name}</td>
                                            <td className="font-bold">{quantity}</td>
                                            <td>
                                                <span
                                                    className={`badge ${product.stock <= 10 ? 'badge-low-stock' : 'badge-in-stock'
                                                        }`}
                                                >
                                                    {product.stock} left
                                                </span>
                                            </td>
                                        </tr>
                                    ) : null
                                )}
                                {topProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center text-muted">
                                            No sales data yet
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
                                {lowStockProducts.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.name}</td>
                                        <td>
                                            <span className="badge badge-low-stock">{p.stock} left</span>
                                        </td>
                                        <td>{formatCurrency(p.sellingPrice)}</td>
                                    </tr>
                                ))}
                                {lowStockProducts.length === 0 && (
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

                {/* Monthly Summary */}
                <div className="card">
                    <div className="card-header">
                        <h2>Monthly Sales Summary</h2>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Sales</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(monthlySales).map(([month, amount]) => (
                                    <tr key={month}>
                                        <td>{month}</td>
                                        <td className="font-bold">{formatCurrency(amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
