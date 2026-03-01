import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FiSearch, FiSave } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

export default function TrackingPage() {
    const { orders, dispatch, hasPermission, getCustomerById, getProductById } = useApp();
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [trackingInput, setTrackingInput] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filtered = orders
        .filter((o) => {
            const customer = getCustomerById(o.customerId);
            const matchesSearch =
                o.id.toLowerCase().includes(search.toLowerCase()) ||
                (customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (o.trackingId || '').toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const startEditing = (order) => {
        setEditingId(order.id);
        setTrackingInput(order.trackingId || '');
    };

    const saveTracking = (orderId) => {
        if (!trackingInput.trim()) return;
        dispatch({
            type: 'UPDATE_TRACKING',
            payload: { orderId, trackingId: trackingInput.trim() },
        });
        setEditingId(null);
        setTrackingInput('');
    };

    const sendWhatsApp = (order) => {
        const customer = getCustomerById(order.customerId);
        if (!customer || !order.trackingId) return;

        const message = `Hello ${customer.name},

Your order has been shipped.

Your Tracking ID is: ${order.trackingId}

Thank you.`;

        const phone = customer.phone.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const getStatusBadge = (status) => {
        const map = {
            pending: 'badge-pending',
            shipped: 'badge-shipped',
            delivered: 'badge-delivered',
        };
        const labels = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>Shipment Tracking ({filtered.length})</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search by order, customer, tracking..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="tracking-search"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: '160px' }}
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                        </select>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Products</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Tracking ID</th>
                                <th>WhatsApp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((order) => {
                                const customer = getCustomerById(order.customerId);
                                const isEditing = editingId === order.id;
                                return (
                                    <tr key={order.id}>
                                        <td className="font-mono font-bold">{order.id}</td>
                                        <td>
                                            <div>
                                                <div className="font-bold">{customer?.name || 'Unknown'}</div>
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {customer?.phone}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {order.items.map((item) => {
                                                const p = getProductById(item.productId);
                                                return p ? `${p.name} x${item.quantity}` : '';
                                            }).filter(Boolean).join(', ')}
                                        </td>
                                        <td className="font-bold">{formatCurrency(order.total)}</td>
                                        <td>{getStatusBadge(order.status)}</td>
                                        <td>
                                            {isEditing && hasPermission('addTracking') ? (
                                                <div className="tracking-row">
                                                    <input
                                                        style={{ maxWidth: '180px' }}
                                                        placeholder="Enter Tracking ID"
                                                        value={trackingInput}
                                                        onChange={(e) => setTrackingInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveTracking(order.id);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        className="btn btn-success btn-sm btn-icon"
                                                        onClick={() => saveTracking(order.id)}
                                                        title="Save"
                                                    >
                                                        <FiSave size={14} />
                                                    </button>
                                                </div>
                                            ) : order.trackingId ? (
                                                <span
                                                    className="font-mono"
                                                    style={{ cursor: hasPermission('addTracking') ? 'pointer' : 'default' }}
                                                    onClick={() => hasPermission('addTracking') && startEditing(order)}
                                                    title={hasPermission('addTracking') ? 'Click to edit' : ''}
                                                >
                                                    {order.trackingId}
                                                </span>
                                            ) : hasPermission('addTracking') ? (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => startEditing(order)}
                                                >
                                                    + Add Tracking
                                                </button>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td>
                                            {order.trackingId && hasPermission('sendWhatsApp') ? (
                                                <button
                                                    className="whatsapp-btn"
                                                    onClick={() => sendWhatsApp(order)}
                                                    title={`Send tracking to ${customer?.name} on WhatsApp`}
                                                    id={`whatsapp-${order.id}`}
                                                >
                                                    <FaWhatsapp />
                                                </button>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
                                                    {order.trackingId ? '—' : 'No tracking'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">🚚</div>
                                            <h3>No orders found</h3>
                                            <p>Orders will appear here for tracking management</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
