import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FiSearch, FiSave, FiX } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

const PAGE_SIZE = 20;

export default function TrackingPage() {
    const { orders, ordersTotal, hasPermission, getCustomerById, getProductById, updateOrder, api, searchOrders } = useApp();
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [trackingInput, setTrackingInput] = useState('');
    const [partnerInput, setPartnerInput] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');
    const [deliveryPartners, setDeliveryPartners] = useState([]);
    const [page, setPage] = useState(1);

    useEffect(() => {
        api('/delivery_partners').then(res => setDeliveryPartners(res || [])).catch(() => { });
    }, []);

    // Compute tracking link using only DB-saved partners
    const getTrackingLink = (partnerName) => {
        if (!partnerName) return '';
        const found = deliveryPartners.find(dp => dp.name === partnerName);
        return found?.tracking_url_template || '';
    };

    // Server-side search and pagination
    useEffect(() => {
        const timer = setTimeout(() => {
            searchOrders({
                query: search,
                page,
                limit: PAGE_SIZE,
                status: statusFilter,
                paymentStatus: 'all',
                dateFilter: dateFilter || 'all'
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [search, page, statusFilter, dateFilter, searchOrders]);

    const totalPages = Math.ceil((ordersTotal || 0) / PAGE_SIZE);
    const paginated = (orders || []).slice(0, PAGE_SIZE);

    const startEditing = (order) => {
        setEditingId(order.id);
        setTrackingInput(order.trackingId || '');
        setPartnerInput(order.deliveryPartner || '');
    };

    const cancelEditing = () => {
        setEditingId(null);
        setTrackingInput('');
        setPartnerInput('');
    };

    const saveTracking = (orderId) => {
        const tid = trackingInput.trim();
        if (!tid && !partnerInput) return;
        const tLink = getTrackingLink(partnerInput);
        updateOrder(orderId, {
            trackingId: tid,
            deliveryPartner: partnerInput || '',
            trackingLink: tLink,
            status: tid ? 'shipped' : undefined,
        });
        cancelEditing();
    };

    const sendWhatsApp = (order) => {
        const customer = getCustomerById(order.customerId);
        const name = order.customerName || customer?.name || 'Customer';
        const rawPhone = order.customerPhone || customer?.phone || '';

        let phone = rawPhone.replace(/[^0-9]/g, '');
        if (phone.length === 10) phone = '91' + phone;

        if (!phone) {
            console.error('No phone number found for order:', order.id);
            return;
        }

        const tLink = order.trackingLink || '';
        const isWa = tLink.includes('wa.me') || tLink.includes('whatsapp');

        // If the saved tracking link IS a WhatsApp link, open it directly
        if (isWa) {
            window.open(tLink, '_blank');
            return;
        }

        const dispatchDate = new Date(order.shippedDate || Date.now())
            .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            .replace(/\//g, '.');
        const partner = order.deliveryPartner || 'Courier';

        const message = `Hello ${name}, your order has been dispatched on ${dispatchDate} via ${partner}. Use tracking ID [${order.trackingId}] to follow your delivery using link [${tLink || 'https://snahorganics.com'}]. Thanks for choosing SNAH Organics.\n\nwww.snahorganics.com\n\nPlease Note ⚠️ : Opening video is must to claim the parcel issues.`;
        
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const getStatusBadge = (status) => {
        const map = { pending: 'badge-pending', shipped: 'badge-shipped', delivered: 'badge-delivered', returned: 'badge-returned' };
        const labels = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered', returned: 'Returned' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>Shipment Tracking ({ordersTotal || 0})</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search by order, customer, partner, tracking..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                id="tracking-search"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="date" 
                                value={dateFilter} 
                                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} 
                                style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
                                title="Filter by Created Date"
                            />
                            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ maxWidth: '160px' }}>
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="returned">Returned</option>
                            </select>
                        </div>
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
                                <th>Delivery Partner</th>
                                <th>Tracking ID</th>
                                <th>WhatsApp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((order) => {
                                const customer = getCustomerById(order.customerId);
                                const isEditing = editingId === order.id;
                                return (
                                    <tr key={order.id}>
                                        <td data-label="Order ID" className="font-mono font-bold" style={{ fontSize: '0.82rem' }}>{order.id}</td>
                                        <td data-label="Customer">
                                            <div className="font-bold">{customer?.name || order.customerName || 'Unknown'}</div>
                                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{customer?.phone || order.customerPhone}</div>
                                        </td>
                                        <td data-label="Products" style={{ fontSize: '0.82rem' }}>
                                            {(order.items || []).map((item) => {
                                                const p = getProductById(item.productId);
                                                return p ? `${p.name} x${item.quantity}` : '';
                                            }).filter(Boolean).join(', ')}
                                        </td>
                                        <td data-label="Total" className="font-bold">{formatCurrency(order.total)}</td>
                                        <td data-label="Status">{getStatusBadge(order.status)}</td>

                                        {/* Delivery Partner */}
                                        <td data-label="Delivery Partner">
                                            {isEditing && hasPermission('addTracking') ? (
                                                <select value={partnerInput} onChange={e => setPartnerInput(e.target.value)} style={{ minWidth: '130px' }}>
                                                    <option value="">Select Partner</option>
                                                    {deliveryPartners.map(dp => (
                                                        <option key={dp.id} value={dp.name}>{dp.name}</option>
                                                    ))}
                                                </select>
                                            ) : order.deliveryPartner ? (
                                                <span
                                                    style={{ cursor: hasPermission('addTracking') ? 'pointer' : 'default', fontSize: '0.875rem' }}
                                                    onClick={() => hasPermission('addTracking') && startEditing(order)}
                                                    title={hasPermission('addTracking') ? 'Click to edit' : ''}
                                                >
                                                    {order.deliveryPartner}
                                                </span>
                                            ) : hasPermission('addTracking') ? (
                                                <button className="btn btn-secondary btn-sm" onClick={() => startEditing(order)}>
                                                    + Set Partner
                                                </button>
                                            ) : <span className="text-muted">—</span>}
                                        </td>

                                        {/* Tracking ID */}
                                        <td data-label="Tracking">
                                            {isEditing && hasPermission('addTracking') ? (
                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                    <input
                                                        style={{ maxWidth: '140px' }}
                                                        placeholder="AWB / Tracking ID"
                                                        value={trackingInput}
                                                        onChange={(e) => setTrackingInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveTracking(order.id);
                                                            if (e.key === 'Escape') cancelEditing();
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button className="btn btn-success btn-sm btn-icon" onClick={() => saveTracking(order.id)} title="Save"><FiSave size={14} /></button>
                                                    <button className="btn btn-secondary btn-sm btn-icon" onClick={cancelEditing} title="Cancel"><FiX size={14} /></button>
                                                </div>
                                            ) : order.trackingId ? (
                                                <span
                                                    className="font-mono"
                                                    style={{ cursor: hasPermission('addTracking') ? 'pointer' : 'default', fontSize: '0.82rem' }}
                                                    onClick={() => hasPermission('addTracking') && startEditing(order)}
                                                    title={hasPermission('addTracking') ? 'Click to edit' : ''}
                                                >
                                                    {order.trackingId}
                                                </span>
                                            ) : hasPermission('addTracking') ? (
                                                <button className="btn btn-secondary btn-sm" onClick={() => startEditing(order)}>+ Add Tracking</button>
                                            ) : <span className="text-muted">—</span>}
                                        </td>

                                        {/* WhatsApp */}
                                        <td data-label="WhatsApp">
                                            {(order.trackingId || order.trackingLink) && hasPermission('sendWhatsApp') ? (
                                                <button
                                                    className="whatsapp-btn"
                                                    onClick={() => sendWhatsApp(order)}
                                                    title={`Send tracking to ${customer?.name}`}
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
                            {paginated.length === 0 && (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">🚚</div>
                                            <h3>No orders found</h3>
                                            <p>Try adjusting your search or filters</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'var(--gray-50)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, ordersTotal)} of {ordersTotal} orders
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 8px' }}>Page {page} of {totalPages}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
