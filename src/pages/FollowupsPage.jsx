import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { FiMessageCircle, FiCheckCircle } from 'react-icons/fi';

export default function FollowupsPage() {
    const { orders, customers, getCustomerById, updateOrder } = useApp();
    const [activeTab, setActiveTab] = useState('shipped_followup'); // 'shipped_followup' or 'delivered_followup'

    const today = new Date();

    const getDaysSince = (dateStr) => {
        if (!dateStr) return 0;
        return Math.floor((today - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    };

    const shippedPending = orders.filter(o => o.status === 'shipped' && getDaysSince(o.shippedDate || o.createdAt) >= 7);
    const allDelivered = orders.filter(o => o.status === 'delivered' && o.trackingId);

    const markDelivered = (orderId) => {
        updateOrder(orderId, { status: 'delivered', deliveredDate: new Date().toISOString() });
    };

    const formatCurrency = (val) =>
        '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let displayedOrders = [];
    if (activeTab === 'shipped_followup') displayedOrders = shippedPending;
    if (activeTab === 'all_delivered') displayedOrders = allDelivered;



    return (
        <div className="card">
            <div className="card-header">
                <h2>Followup Reminders</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className={`btn ${activeTab === 'shipped_followup' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setActiveTab('shipped_followup')}
                    >
                        Shipped &gt; 7 Days
                    </button>
                    <button
                        className={`btn ${activeTab === 'all_delivered' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setActiveTab('all_delivered')}
                    >
                        Delivered Followups
                    </button>
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
                            <th>Days Passed</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedOrders.map(order => {
                            const customer = getCustomerById(order.customerId);
                            const daysPassed = getDaysSince(activeTab === 'shipped_followup' ? (order.shippedDate || order.createdAt) : (order.deliveredDate || order.updatedAt));

                            return (
                                <tr key={order.id}>
                                    <td className="font-mono font-bold">{order.id}</td>
                                    <td>
                                        <div className="font-bold">{customer?.name}</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{customer?.phone}</div>
                                    </td>
                                    <td className="font-bold">{formatCurrency(order.total)}</td>
                                    <td>
                                        <div>{order.deliveryPartner || '—'}</div>
                                        <div className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>{order.trackingId || '—'}</div>
                                    </td>
                                    <td>
                                        <span className={`badge ${daysPassed > (activeTab === 'shipped_followup' ? 14 : 35) ? 'badge-unpaid' : 'badge-partial'}`}>
                                            {daysPassed} Days
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            {activeTab === 'shipped_followup' && (
                                                <>
                                                    <a
                                                        href={`https://wa.me/${customer?.phone}?text=${encodeURIComponent(`Hi ${customer?.name}, just checking if you received your order ${order.id}?`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-sm"
                                                        style={{ background: '#25D366', color: '#fff', padding: '6px 10px', fontSize: '0.75rem' }}
                                                    >
                                                        <FiMessageCircle size={14} /> WhatsApp
                                                    </a>
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => markDelivered(order.id)}
                                                    >
                                                        <FiCheckCircle size={14} /> Set Delivered
                                                    </button>
                                                </>
                                            )}
                                            {activeTab === 'all_delivered' && daysPassed < 29 && (
                                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                    Delivered. Refill eligible in {29 - daysPassed} days.
                                                </span>
                                            )}
                                            {activeTab === 'all_delivered' && daysPassed >= 29 && (
                                                <a
                                                    href={`https://wa.me/${customer?.phone}?text=${encodeURIComponent(`Hi ${customer?.name}, it's been a month since you received order ${order.id}. Hope you're enjoying our products! Need a refill?`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm"
                                                    style={{ background: '#25D366', color: '#fff', padding: '6px 10px', fontSize: '0.75rem' }}
                                                >
                                                    <FiMessageCircle size={14} /> Refill Ping
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {displayedOrders.length === 0 && (
                            <tr>
                                <td colSpan={6}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon">✅</div>
                                        <h3>No pending followups</h3>
                                        <p>You're all caught up on this category.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
