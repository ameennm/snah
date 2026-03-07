import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiCheck, FiRefreshCcw } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

const PAGE_SIZE = 20;
const LS_7 = 'followup_done_7';
const LS_29 = 'followup_done_29';

const loadDone = (key) => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch { return new Set(); }
};
const saveDone = (key, set) => {
    localStorage.setItem(key, JSON.stringify([...set]));
};

const WA_BTN = (extra = {}) => ({
    display: 'flex', alignItems: 'center', gap: '5px',
    border: 'none', borderRadius: '6px', padding: '5px 10px',
    fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500,
    background: '#25D366', color: '#fff',
    ...extra,
});

export default function FollowupsPage() {
    const { orders, getCustomerById, updateOrder } = useApp();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');
    const [page, setPage] = useState(1);
    const [done7, setDone7] = useState(() => loadDone(LS_7));
    const [done29, setDone29] = useState(() => loadDone(LS_29));

    const today = new Date();
    const getDaysSince = (dateStr) => {
        if (!dateStr) return 0;
        return Math.floor((today - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    };

    // All tab — every shipped or delivered order
    const allOrders = useMemo(() =>
        orders
            .filter(o => o.status === 'shipped' || o.status === 'delivered')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        [orders]);

    // 7-day tab — shipped/delivered, 7+ days since shipped, not dismissed
    const day7Orders = useMemo(() =>
        orders
            .filter(o =>
                (o.status === 'shipped' || o.status === 'delivered') &&
                o.trackingId &&
                getDaysSince(o.shippedDate || o.createdAt) >= 7 &&
                !done7.has(o.id)
            )
            .sort((a, b) => getDaysSince(b.shippedDate || b.createdAt) - getDaysSince(a.shippedDate || a.createdAt)),
        [orders, done7]);

    // 29-day tab — any order 29+ days since shipped, not dismissed
    const day29Orders = useMemo(() =>
        orders
            .filter(o =>
                o.trackingId &&
                getDaysSince(o.shippedDate || o.createdAt) >= 29 &&
                !done29.has(o.id)
            )
            .sort((a, b) => getDaysSince(b.shippedDate || b.createdAt) - getDaysSince(a.shippedDate || a.createdAt)),
        [orders, done29]);

    // Returned tab — all returned orders
    const returnedOrders = useMemo(() =>
        orders
            .filter(o => o.status === 'returned')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        [orders]);

    const markDone7 = (orderId) => {
        const next = new Set(done7); next.add(orderId); setDone7(next); saveDone(LS_7, next);
    };
    const markDone29 = (orderId) => {
        const next = new Set(done29); next.add(orderId); setDone29(next); saveDone(LS_29, next);
    };
    const markDelivered = (orderId) => {
        updateOrder(orderId, { status: 'delivered', deliveredDate: new Date().toISOString() });
    };
    const goRedispatch = (order) => {
        navigate('/orders', { state: { redispatchOrder: order } });
    };

    const tabs = [
        { id: 'all', label: 'All', count: allOrders.length, color: '#6366f1' },
        { id: 'day7', label: '7-Day', count: day7Orders.length, color: '#d97706' },
        { id: 'day29', label: '29-Day', count: day29Orders.length, color: '#7c3aed' },
        { id: 'returned', label: 'Returned', count: returnedOrders.length, color: '#dc2626' },
    ];

    const sourceMap = { all: allOrders, day7: day7Orders, day29: day29Orders, returned: returnedOrders };
    const displayedOrders = sourceMap[activeTab] || [];
    const totalPages = Math.ceil(displayedOrders.length / PAGE_SIZE);
    const paginated = displayedOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const sendWhatsApp = (order, type) => {
        const customer = getCustomerById(order.customerId);
        if (!customer) return;
        const phone = customer.phone.replace(/[^0-9]/g, '');
        const name = customer.name;
        let message = '';
        if (type === 'day7') {
            message = `Hi ${name}! 😊 We're checking in on your SNAH Organics order (${order.id}). Has your product arrived safely? Please let us know if you have any questions.\n\nWarm regards,\nSNAH Organics 🌿\nwww.snahorganics.com`;
        } else if (type === 'day29') {
            message = `Hi ${name}! 🌟 It's been about a month since you received your SNAH Organics order (${order.id}). How is the result? We'd love to hear your feedback! 💚\n\nYour experience matters to us. Feel free to reply or leave a review.\n\nThank you for choosing SNAH Organics 🌿\nwww.snahorganics.com`;
        } else {
            message = `Hi ${name}! Thank you for your order (${order.id}) with SNAH Organics. We hope you're enjoying your products! 🌿\nwww.snahorganics.com`;
        }
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const formatCurrency = (val) =>
        '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const tabInfo = {
        all: { emoji: '📋', desc: 'All shipped and delivered orders — send follow-up or mark as delivered.' },
        day7: { emoji: '📦', desc: 'Orders shipped 7+ days ago — check if the product arrived safely.' },
        day29: { emoji: '🌟', desc: 'Orders shipped 29+ days ago — ask for feedback and product results.' },
        returned: { emoji: '↩️', desc: 'Returned orders — redispatch to ship again with a new tracking ID.' },
    };

    return (
        <div className="card">
            {/* Header */}
            <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                <h2>Followup Reminders</h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setActiveTab(tab.id); setPage(1); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {tab.label}
                            <span style={{
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : tab.color,
                                color: '#fff', borderRadius: '10px', padding: '1px 7px',
                                fontSize: '0.72rem', fontWeight: 700
                            }}>{tab.count}</span>
                        </button>
                    ))}
                </div>
                <div style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--gray-50)', border: '1px solid var(--border-light)',
                    fontSize: '0.82rem', color: 'var(--text-secondary)'
                }}>
                    {tabInfo[activeTab].emoji} {tabInfo[activeTab].desc}
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Total</th>
                            <th>Partner / Tracking</th>
                            <th>Shipped</th>
                            <th>Days</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.map(order => {
                            const customer = getCustomerById(order.customerId);
                            const refDate = order.shippedDate || order.createdAt;
                            const daysPassed = getDaysSince(refDate);

                            return (
                                <tr key={order.id}>
                                    <td className="font-mono font-bold" style={{ fontSize: '0.82rem' }}>{order.id}</td>
                                    <td>
                                        <div className="font-bold">{customer?.name || '—'}</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{customer?.phone}</div>
                                    </td>
                                    <td className="font-bold">{formatCurrency(order.total)}</td>
                                    <td>
                                        <div style={{ fontSize: '0.875rem' }}>{order.deliveryPartner || '—'}</div>
                                        <div className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>{order.trackingId || '—'}</div>
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        {formatDate(refDate)}
                                    </td>
                                    <td>
                                        <span className={`badge ${daysPassed >= 29 ? 'badge-unpaid' :
                                            daysPassed >= 7 ? 'badge-partial' : 'badge-paid'
                                            }`}>{daysPassed}d</span>
                                    </td>
                                    <td>
                                        <select
                                            value={order.status}
                                            onChange={e => {
                                                const s = e.target.value;
                                                const update = { status: s };
                                                if (s === 'delivered') update.deliveredDate = new Date().toISOString();
                                                updateOrder(order.id, update);
                                            }}
                                            style={{
                                                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                                border: '1px solid var(--border-light)', borderRadius: '6px',
                                                padding: '3px 6px',
                                                background: order.status === 'shipped' ? '#eff6ff' :
                                                    order.status === 'delivered' ? '#f0fdf4' :
                                                        order.status === 'returned' ? '#fef2f2' : 'var(--gray-50)',
                                                color: order.status === 'shipped' ? '#1d4ed8' :
                                                    order.status === 'delivered' ? '#15803d' :
                                                        order.status === 'returned' ? '#b91c1c' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="returned">Returned</option>
                                        </select>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>

                                            {/* ── All tab ── */}
                                            {activeTab === 'all' && (<>
                                                <button onClick={() => sendWhatsApp(order, 'day7')} style={WA_BTN()} title="Is the product arrived?">
                                                    <FaWhatsapp size={13} /> Arrived?
                                                </button>
                                                {daysPassed >= 29 && (
                                                    <button onClick={() => sendWhatsApp(order, 'day29')} style={WA_BTN({ background: '#075e54' })} title="Request feedback">
                                                        <FaWhatsapp size={13} /> Feedback
                                                    </button>
                                                )}
                                                {order.status === 'shipped' && (
                                                    <button className="btn btn-success btn-sm" onClick={() => markDelivered(order.id)} style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
                                                        <FiCheckCircle size={12} /> Delivered
                                                    </button>
                                                )}
                                            </>)}

                                            {/* ── 7-day tab ── */}
                                            {activeTab === 'day7' && (<>
                                                <button onClick={() => sendWhatsApp(order, 'day7')} style={WA_BTN()} title="Is the product arrived?">
                                                    <FaWhatsapp size={13} /> Arrived?
                                                </button>
                                                {order.status === 'shipped' && (
                                                    <button className="btn btn-success btn-sm" onClick={() => markDelivered(order.id)} style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
                                                        <FiCheckCircle size={12} /> Delivered
                                                    </button>
                                                )}
                                                <button className="btn btn-secondary btn-sm" onClick={() => markDone7(order.id)} title="Mark done — won't show here again"
                                                    style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <FiCheck size={12} /> Done
                                                </button>
                                            </>)}

                                            {/* ── 29-day tab ── */}
                                            {activeTab === 'day29' && (<>
                                                <button onClick={() => sendWhatsApp(order, 'day29')} style={WA_BTN({ background: '#075e54' })} title="Request feedback">
                                                    <FaWhatsapp size={13} /> Feedback
                                                </button>
                                                {order.status === 'shipped' && (
                                                    <button className="btn btn-success btn-sm" onClick={() => markDelivered(order.id)} style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
                                                        <FiCheckCircle size={12} /> Delivered
                                                    </button>
                                                )}
                                                <button className="btn btn-secondary btn-sm" onClick={() => markDone29(order.id)} title="Mark done — won't show here again"
                                                    style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <FiCheck size={12} /> Done
                                                </button>
                                            </>)}

                                            {/* ── Returned tab ── */}
                                            {activeTab === 'returned' && (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => goRedispatch(order)}
                                                    style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                                    title="Create a new order for this customer with same items"
                                                >
                                                    <FiRefreshCcw size={13} /> Redispatch
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {displayedOrders.length === 0 && (
                            <tr>
                                <td colSpan={8}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon">
                                            {activeTab === 'all' ? '📋' : activeTab === 'day7' ? '📦' : activeTab === 'day29' ? '🌟' : '↩️'}
                                        </div>
                                        <h3>No orders here</h3>
                                        <p>
                                            {activeTab === 'all' && 'No shipped or delivered orders yet.'}
                                            {activeTab === 'day7' && 'No pending 7-day check-ins — all caught up!'}
                                            {activeTab === 'day29' && 'No pending 29-day feedback requests — all caught up!'}
                                            {activeTab === 'returned' && 'No returned orders.'}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'var(--gray-50)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayedOrders.length)} of {displayedOrders.length}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setPage(p)} style={{ minWidth: '32px' }}>{p}</button>
                        ))}
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
                    </div>
                </div>
            )}
        </div>
    );
}
