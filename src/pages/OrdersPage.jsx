import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiTrash2, FiEye, FiUserCheck, FiUserPlus, FiDollarSign, FiMessageCircle, FiTruck, FiRefreshCcw, FiEdit } from 'react-icons/fi';

export default function OrdersPage() {
    const { orders, customers, products, hasPermission, getCustomerById, getProductById, user, addCustomerAsync, addOrder, updateOrder, deleteOrder, api, crmLeads } = useApp();
    const [allUsers, setAllUsers] = useState([]);

    useEffect(() => {
        api('/users').then(setAllUsers).catch(() => { });
    }, [api]);
    const location = useLocation();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [viewOrder, setViewOrder] = useState(null);
    const [editOrderId, setEditOrderId] = useState(null);
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [showPaymentModal, setShowPaymentModal] = useState(null);
    const [paymentInput, setPaymentInput] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Return Modal
    const [showReturnModal, setShowReturnModal] = useState(null);
    const [returnReason, setReturnReason] = useState('');

    // Delete Modal
    const [showDeleteModal, setShowDeleteModal] = useState(null);

    // Delivery Partners
    const [deliveryPartners, setDeliveryPartners] = useState([]);

    // Customer inline form
    const [customerName, setCustomerName] = useState('');
    const [countryCode, setCountryCode] = useState('91');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerArea, setCustomerArea] = useState('');

    // Order items & details
    const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1 }]);
    const [paymentStatus, setPaymentStatus] = useState('not_paid');
    const [initialPaidAmount, setInitialPaidAmount] = useState('');
    const [discount, setDiscount] = useState('');
    const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percent'
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [trackingId, setTrackingId] = useState('');
    const [newDeliveryPartner, setNewDeliveryPartner] = useState('');

    useEffect(() => {
        api('/delivery_partners').then(res => setDeliveryPartners(res || [])).catch(() => { });
    }, []);

    // Auto-trigger redispatch if navigated here from Followups
    useEffect(() => {
        if (location.state?.redispatchOrder) {
            const order = location.state.redispatchOrder;
            // Clear state so back-navigation doesn't re-trigger
            navigate(location.pathname, { replace: true, state: {} });
            // Wait for deliveryPartners to load, then open
            setTimeout(() => openRedispatch(order), 100);
        }
    }, [location.state]);

    // Auto-match customer by phone
    const fullPhone = useMemo(() => {
        const cleaned = customerPhone.replace(/[^0-9]/g, '');
        const code = countryCode.replace(/[^0-9]/g, '');
        return code + cleaned;
    }, [countryCode, customerPhone]);

    const matchedCustomer = useMemo(() => {
        if (!customerPhone || customerPhone.length < 5) return null;
        return customers.find((c) => c.phone.replace(/[^0-9]/g, '') === fullPhone);
    }, [fullPhone, customers]);

    const filtered = orders
        .filter((o) => {
            if (activeTab === 'pending') return o.status === 'pending';
            if (activeTab === 'shipped') return o.status === 'shipped';
            if (activeTab === 'delivered') return o.status === 'delivered';
            if (activeTab === 'returned') return o.status === 'returned';
            if (activeTab === 'completed_deliveries') return o.status === 'shipped' || o.status === 'delivered';
            return true;
        })
        .filter((o) => {
            const customer = getCustomerById(o.customerId);
            const matchesSearch =
                o.id.toLowerCase().includes(search.toLowerCase()) ||
                (customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (customer?.phone || '').toLowerCase().includes(search.toLowerCase()) ||
                (o.trackingId || '').toLowerCase().includes(search.toLowerCase());
            const matchesPayment =
                paymentFilter === 'all' || o.paymentStatus === paymentFilter;
            return matchesSearch && matchesPayment;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const addItem = () => setOrderItems([...orderItems, { productId: '', quantity: 1 }]);
    const removeItem = (index) => setOrderItems(orderItems.filter((_, i) => i !== index));
    const updateItem = (index, field, value) => {
        const updated = [...orderItems];
        updated[index] = { ...updated[index], [field]: value };
        setOrderItems(updated);
    };

    const calculateOrderTotal = () => {
        let subtotal = 0, gstTotal = 0;
        orderItems.forEach((item) => {
            if (!item.productId || !item.quantity) return;
            const product = getProductById(Number(item.productId));
            if (!product) return;
            const lineSubtotal = product.sellingPrice * Number(item.quantity);
            subtotal += lineSubtotal;
            gstTotal += (lineSubtotal * product.gst) / 100;
        });

        let disAmt = Number(discount) || 0;
        let effectiveSubtotal = subtotal;

        if (discountType === 'percent') {
            disAmt = (subtotal * disAmt) / 100;
        }

        if (disAmt > subtotal) disAmt = subtotal;
        effectiveSubtotal -= disAmt;

        // Recompute GST on discounted subtotal proportionally if needed, but simple way is flat total 
        // For simplicity, we'll apply discount to final total or subtotal. We'll subtract from total.
        const total = Math.max(0, subtotal + gstTotal - disAmt);

        return { subtotal, gstTotal, disAmt, total };
    };

    const resetForm = () => {
        setCustomerName(''); setCustomerPhone(''); setCountryCode('91');
        setCustomerAddress(''); setCustomerArea('');
        setOrderItems([{ productId: '', quantity: 1 }]);
        setPaymentStatus('not_paid'); setInitialPaidAmount('');
        setDiscount(''); setDiscountType('flat');
        setOrderDate(new Date().toISOString().split('T')[0]);
        setTrackingId(''); setNewDeliveryPartner('');
        setEditOrderId(null);
        setShowCreate(false);
    };

    // Compute tracking link using ONLY DB-saved delivery partners
    const getTrackingLink = (partnerName) => {
        if (!partnerName) return '';
        const found = deliveryPartners.find(dp => dp.name === partnerName);
        return found?.tracking_url_template || '';
    };

    const handleCreateOrder = async (isRedispatch = false, redispatchOrder = null) => {
        const validItems = orderItems.filter((i) => i.productId && i.quantity > 0);
        // Use matched customer's name if phone found an existing customer
        const effectiveName = matchedCustomer ? matchedCustomer.name : customerName;
        if (!effectiveName || !customerPhone || validItems.length === 0) return;

        const items = validItems.map((i) => {
            const product = getProductById(Number(i.productId));
            if (!product) return null;
            return { productId: Number(i.productId), quantity: Number(i.quantity), price: product.sellingPrice, gst: product.gst };
        }).filter(Boolean);

        if (items.length === 0) return;

        const { subtotal, gstTotal, total } = calculateOrderTotal();
        const paidAmount = paymentStatus === 'paid' ? total : (paymentStatus === 'partial' ? Number(initialPaidAmount) || 0 : 0);

        try {
            let customerId;
            if (matchedCustomer) {
                customerId = matchedCustomer.id;
            } else {
                const realCustomer = await addCustomerAsync({
                    name: effectiveName, phone: fullPhone,
                    address: customerAddress, area: customerArea,
                });
                customerId = realCustomer.id;
            }

            // Close modal immediately
            resetForm();
            setViewOrder(null);

            const payload = {
                customerId, items, subtotal, gstAmount: gstTotal, total,
                discount: discount || 0, discountType,
                paymentStatus, paidAmount,
                trackingId: trackingId.trim() || '',
                deliveryPartner: newDeliveryPartner || '',
                trackingLink: getTrackingLink(newDeliveryPartner),
                createdAt: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString()
            };

            if (editOrderId) {
                updateOrder(editOrderId, { ...payload, updatedBy: user.id });
            } else {
                addOrder({
                    ...payload,
                    createdBy: user.id,
                    isRedispatched: !!(isRedispatch && redispatchOrder),
                    redispatchedFromId: isRedispatch && redispatchOrder ? redispatchOrder.id : null
                }).then(() => {
                    if (isRedispatch && redispatchOrder) {
                        updateOrder(redispatchOrder.id, { isRedispatched: true });
                    }
                }).catch(error => {
                    console.error('Order sync failed:', error);
                    alert('Order could not be saved to server. Please refresh and try again.');
                });
            }

        } catch (error) {
            console.error(error);
            alert('Failed to create customer. Make sure the phone number is not already in use.');
        }
    };

    const handleStatusChange = (orderId, newStatus) => {
        if (newStatus === 'returned') {
            const order = orders.find(o => o.id === orderId);
            setShowReturnModal(order);
            setReturnReason('');
            return;
        }

        const data = { status: newStatus, updatedBy: user.id };
        updateOrder(orderId, data);
        if (viewOrder && viewOrder.id === orderId) setViewOrder({ ...viewOrder, ...data });
    };

    const handleConfirmReturn = () => {
        if (!showReturnModal || !returnReason) return;
        const data = {
            status: 'returned',
            returnReason,
            restoreStock: true,
            updatedBy: user.id
        };
        updateOrder(showReturnModal.id, data);
        if (viewOrder && viewOrder.id === showReturnModal.id) {
            setViewOrder({ ...viewOrder, ...data });
        }
        setShowReturnModal(null);
    };

    const handlePaymentChange = (orderId, newPayment) => {
        const order = orders.find(o => o.id === orderId);
        const data = { paymentStatus: newPayment, updatedBy: user.id };
        if (newPayment === 'paid') {
            data.paidAmount = order?.total || 0;
        } else if (newPayment === 'not_paid') {
            data.paidAmount = 0;
        }
        if (newPayment === 'partial') {
            setShowPaymentModal(order);
            setPaymentInput('');
            return;
        }
        updateOrder(orderId, data);
        if (viewOrder && viewOrder.id === orderId) setViewOrder({ ...viewOrder, ...data });
    };

    const handleAddPayment = () => {
        if (!showPaymentModal || !paymentInput) return;
        const inputAmount = Number(paymentInput);
        if (isNaN(inputAmount) || inputAmount <= 0) return;

        const order = showPaymentModal;
        const currentPaid = order.paidAmount || 0;
        const finalPaid = currentPaid + inputAmount;
        const newStatus = finalPaid >= order.total ? 'paid' : 'partial';

        updateOrder(order.id, { paidAmount: finalPaid, paymentStatus: newStatus, updatedBy: user.id });
        if (viewOrder && viewOrder.id === order.id) {
            setViewOrder({ ...viewOrder, paidAmount: finalPaid, paymentStatus: newStatus });
        }
        setShowPaymentModal(null);
        setPaymentInput('');
    };

    const handleViewFieldChange = (field, value) => {
        if (!viewOrder) return;
        let updates = { [field]: value };

        if (field === 'deliveryPartner') {
            const partner = deliveryPartners.find(dp => dp.name === value);
            updates.trackingLink = partner?.tracking_url_template || '';
        }

        const updated = { ...viewOrder, ...updates };
        setViewOrder(updated);
        updateOrder(viewOrder.id, { ...updates, updatedBy: user.id });
    };

    const handleDeleteOrder = (orderId) => {
        setShowDeleteModal(orderId);
    };

    const confirmDeleteOrder = () => {
        if (showDeleteModal) {
            deleteOrder(showDeleteModal);
            if (viewOrder && viewOrder.id === showDeleteModal) {
                setViewOrder(null);
            }
            setShowDeleteModal(null);
        }
    };

    const formatCurrency = (val) =>
        '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const { subtotal, gstTotal, total, disAmt } = calculateOrderTotal();

    const openRedispatch = (order) => {
        const cust = getCustomerById(order.customerId);
        if (cust) {
            setCustomerName(cust.name);
            setCustomerPhone(cust.phone.slice(-10));
            setCountryCode('91');
            setCustomerAddress(cust.address);
            setCustomerArea(cust.area);
        }
        setOrderItems(order.items.map(i => ({ productId: String(i.productId), quantity: i.quantity })));
        setDiscount(order.discount || '');
        setDiscountType(order.discountType || 'flat');
        setPaymentStatus('not_paid');
        setEditOrderId(null);
        setShowCreate(true);
    };

    const openEdit = (order) => {
        const cust = getCustomerById(order.customerId);
        if (cust) {
            setCustomerName(cust.name);
            setCustomerPhone(cust.phone.slice(-10));
            setCountryCode('91');
            setCustomerAddress(cust.address);
            setCustomerArea(cust.area);
        }
        setOrderItems(order.items.map(i => ({ productId: String(i.productId), quantity: i.quantity })));
        setDiscount(order.discount || '');
        setDiscountType(order.discountType || 'flat');
        setPaymentStatus(order.paymentStatus || 'not_paid');
        setTrackingId(order.trackingId || '');
        setNewDeliveryPartner(order.deliveryPartner || '');
        if (order.createdAt) {
            setOrderDate(new Date(order.createdAt).toISOString().split('T')[0]);
        }
        setEditOrderId(order.id);
        setShowCreate(true);
    };

    // Calculate days since shipped
    const getDaysSince = (dateStr) => {
        if (!dateStr) return 0;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <>
            <div className="card">
                <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex justify-between" style={{ width: '100%', alignItems: 'center' }}>
                        <h2>Orders ({filtered.length})</h2>
                        {hasPermission('createOrder') && (
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-order-btn">
                                <FiPlus /> New Order
                            </button>
                        )}
                    </div>

                    <div className="tabs-container" style={{ display: 'flex', gap: '8px', overflowX: 'auto', width: '100%', paddingBottom: '8px' }}>
                        {[
                            { id: 'all', label: 'All Orders' },
                            { id: 'pending', label: 'Pending' },
                            { id: 'shipped', label: 'Shipped' },
                            { id: 'delivered', label: 'Delivered' },
                            { id: 'returned', label: 'Returned' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setActiveTab(tab.id); setPage(1); }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="filters-row" style={{ width: '100%' }}>
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input placeholder="Search orders, tracking details..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} id="order-search" />
                        </div>
                        <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} style={{ maxWidth: '160px' }}>
                            <option value="all">All Payments</option>
                            <option value="paid">Paid</option>
                            <option value="not_paid">Not Paid</option>
                            <option value="partial">Partial</option>
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
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Tracking / Ref</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((order) => {
                                const customer = getCustomerById(order.customerId);
                                const daysSince = getDaysSince(order.shippedDate);
                                return (
                                    <tr key={order.id} style={order.status === 'returned' ? { opacity: 0.6 } : {}}>
                                        <td data-label="Order ID">
                                            <div className="font-mono font-bold flex items-center gap-4">
                                                {order.id}
                                                {order.isRedispatched && <span title="Redispatched" style={{ color: 'var(--primary-600)' }}><FiRefreshCcw size={12} /></span>}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatDate(order.createdAt)}</div>
                                        </td>
                                        <td data-label="Customer">
                                            <div className="font-bold">{customer?.name || 'Unknown'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{customer?.phone}</div>
                                        </td>
                                        <td data-label="Products" style={{ maxWidth: '200px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {order.items?.map((item) => {
                                                    const prod = getProductById(item.productId);
                                                    return prod ? `${prod.name} x${item.quantity}` : `#${item.productId} x${item.quantity}`;
                                                }).join(', ') || '—'}
                                            </div>
                                        </td>
                                        <td data-label="Total">
                                            <div className="font-bold">{formatCurrency(order.total)}</div>
                                            {order.discount > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--success-600)' }}>Discounted</div>}
                                        </td>
                                        <td data-label="Payment">
                                            <select
                                                value={order.paymentStatus}
                                                onChange={(e) => handlePaymentChange(order.id, e.target.value)}
                                                className={`status-select ${order.paymentStatus === 'paid' ? 'status-paid' : order.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid'}`}
                                                disabled={order.status === 'returned'}
                                            >
                                                <option value="paid">Paid</option>
                                                <option value="not_paid">Unpaid</option>
                                                <option value="partial">Partial</option>
                                            </select>
                                        </td>
                                        <td data-label="Status">
                                            <select
                                                value={order.status}
                                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                className={`status-select ${order.status === 'delivered' ? 'status-delivered' : order.status === 'shipped' ? 'status-shipped' : order.status === 'returned' ? 'status-returned' : 'status-pending'}`}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="shipped">Shipped</option>
                                                <option value="delivered">Delivered</option>
                                                <option value="returned">Returned</option>
                                            </select>
                                        </td>
                                        <td data-label="Tracking">
                                            {order.trackingId ? (
                                                <div className="badge font-mono" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)' }}>
                                                    {order.trackingId}
                                                </div>
                                            ) : '—'}
                                            {order.status === 'returned' && order.returnReason && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--danger-600)', marginTop: '4px' }}>
                                                    Reason: {order.returnReason}
                                                </div>
                                            )}
                                        </td>
                                        <td data-label="Actions">
                                            <div className="flex gap-8">
                                                <button className="btn btn-secondary btn-sm btn-icon" title="View" onClick={() => setViewOrder(order)}>
                                                    <FiEye size={14} />
                                                </button>
                                                {(hasPermission('dashboard') || user.id === order.createdBy) && (
                                                    <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEdit(order)}>
                                                        <FiEdit size={14} />
                                                    </button>
                                                )}
                                                {(hasPermission('dashboard') || user.id === order.createdBy) && (
                                                    <button className="btn btn-secondary btn-sm btn-icon border-danger-light text-danger" title="Delete" onClick={() => handleDeleteOrder(order.id)}>
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={8}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon">🛒</div>
                                        <h3>No orders found</h3>
                                        <p>Create your first order to get started</p>
                                    </div>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'var(--gray-50)' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} orders
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)}
                                    style={{ minWidth: '32px' }}>{p}</button>
                            ))}
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== Return Modal ===== */}
            {showReturnModal && (
                <Modal
                    title={`Mark Order ${showReturnModal.id} as Returned`}
                    onClose={() => setShowReturnModal(null)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowReturnModal(null)}>Cancel</button>
                            <button className="btn btn-danger" disabled={!returnReason} onClick={handleConfirmReturn}>Confirm Return</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label>Reason for Return *</label>
                        <textarea
                            value={returnReason}
                            onChange={e => setReturnReason(e.target.value)}
                            rows={3}
                            placeholder="Customer denied, address incorrect, damaged, etc."
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}
                        ></textarea>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                            Stock for items in this order will be automatically restored.
                        </p>
                    </div>
                </Modal>
            )}

            {/* ===== Add Payment Modal ===== */}
            {/* Same as before... */}
            {showPaymentModal && (
                <Modal
                    title={`Update Payment — ${showPaymentModal.id}`}
                    onClose={() => { setShowPaymentModal(null); setPaymentInput(''); }}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => { setShowPaymentModal(null); setPaymentInput(''); }}>Cancel</button>
                            <button className="btn btn-success" onClick={handleAddPayment}>Update Payment</button>
                        </>
                    }
                >
                    {/* Simplified for space */}
                    <div className="form-group">
                        <label>New Amount Received (₹)</label>
                        <input type="number" value={paymentInput} onChange={(e) => setPaymentInput(e.target.value)} min="0" />
                    </div>
                </Modal>
            )}

            {/* ===== Delete Order Modal ===== */}
            {showDeleteModal && (
                <Modal
                    title="Confirm Delete"
                    onClose={() => setShowDeleteModal(null)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowDeleteModal(null)}>Cancel</button>
                            <button className="btn btn-primary" style={{ background: 'var(--danger-600)', borderColor: 'var(--danger-600)', color: 'white' }} onClick={confirmDeleteOrder}>Delete Order</button>
                        </>
                    }
                >
                    <div style={{ padding: '10px 0' }}>
                        <p>Are you sure you want to delete order <strong>{showDeleteModal}</strong>?</p>
                        <p style={{ marginTop: '10px', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>This action cannot be undone. Product stock for this order will be automatically restored.</p>
                    </div>
                </Modal>
            )}

            {/* ===== Create/Edit Order Modal ===== */}
            {showCreate && (
                <Modal
                    title={editOrderId ? "Edit Order" : "Create New Order"}
                    onClose={resetForm}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => handleCreateOrder()}
                                disabled={!(matchedCustomer ? matchedCustomer.name : customerName) || !customerPhone || orderItems.filter(i => i.productId).length === 0} id="submit-order-btn">
                                {editOrderId ? `Save Order — ${formatCurrency(total)}` : `Create Order — ${formatCurrency(total)}`}
                            </button>
                        </>
                    }
                >
                    {/* Customer Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <div className="form-group">
                            <label>Order Date</label>
                            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                        </div>
                        <div className="form-group mt-2">
                            <label>Phone Number *</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={{ maxWidth: '70px', textAlign: 'center' }} />
                                <input type="tel" placeholder="Customer Mobile" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ flex: 1 }} />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label>Customer Name *</label>
                            <input value={matchedCustomer ? matchedCustomer.name : customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={!!matchedCustomer} />
                        </div>
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label>Location / Area *</label>
                            <input value={matchedCustomer ? (matchedCustomer.area || matchedCustomer.address) : customerArea} onChange={(e) => setCustomerArea(e.target.value)} disabled={!!matchedCustomer} />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px' }}>📦 Items</h3>
                        {orderItems.map((item, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} style={{ flex: 2 }}>
                                    <option value="">Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} (₹{p.sellingPrice})</option>
                                    ))}
                                </select>
                                <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} style={{ flex: 0.7 }} />
                                {orderItems.length > 1 && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => removeItem(index)}><FiTrash2 /></button>
                                )}
                            </div>
                        ))}
                        <button className="btn btn-secondary btn-sm" onClick={addItem}><FiPlus /> Add Product</button>
                    </div>

                    {/* Discount & Payment */}
                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Discount Option</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={{ maxWidth: '80px' }}>
                                    <option value="flat">₹</option>
                                    <option value="percent">%</option>
                                </select>
                                <input type="number" placeholder="Discount" value={discount} onChange={e => setDiscount(e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Payment Status</label>
                            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                                <option value="not_paid">Not Paid</option>
                                <option value="paid">Paid</option>
                                <option value="partial">Partial</option>
                            </select>
                        </div>
                    </div>

                    {/* Delivery Partner + Tracking ID side by side */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Delivery Partner <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                            <select value={newDeliveryPartner} onChange={e => setNewDeliveryPartner(e.target.value)}>
                                <option value="">Select Partner</option>
                                {deliveryPartners.map(dp => <option key={dp.id} value={dp.name}>{dp.name}</option>)}
                            </select>
                            {newDeliveryPartner && getTrackingLink(newDeliveryPartner) && (
                                <small style={{ color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
                                    🔗 {getTrackingLink(newDeliveryPartner)}
                                </small>
                            )}
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Tracking ID <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                            <input
                                type="text"
                                placeholder="AWB / Tracking number"
                                value={trackingId}
                                onChange={e => setTrackingId(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                        {disAmt > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>-{formatCurrency(disAmt)}</span></div>}
                        <div className="flex justify-between"><span>GST</span><span>{formatCurrency(gstTotal)}</span></div>
                        <div className="flex justify-between font-bold" style={{ paddingTop: '8px', borderTop: '1px solid var(--border-light)', marginTop: '8px' }}>
                            <span>Total</span><span style={{ color: 'var(--primary-600)' }}>{formatCurrency(total)}</span>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ===== View Order Modal ===== */}
            {viewOrder && (
                <Modal
                    title={`Order Details: ${viewOrder.id}`}
                    onClose={() => setViewOrder(null)}
                    footer={
                        <>
                            {viewOrder.status === 'returned' && (
                                <button className="btn btn-primary" onClick={() => { setViewOrder(null); openRedispatch(viewOrder); }}>
                                    <FiRefreshCcw size={14} /> Redispatch Order
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setViewOrder(null)}>Close</button>
                        </>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Status & Tracking row */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Delivery Status</label>
                                <select value={viewOrder.status} onChange={(e) => handleStatusChange(viewOrder.id, e.target.value)}>
                                    <option value="pending">Pending</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="returned">Returned</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Delivery Partner</label>
                                <select
                                    value={viewOrder.deliveryPartner || ''}
                                    onChange={(e) => handleViewFieldChange('deliveryPartner', e.target.value)}
                                >
                                    <option value="">Select Partner</option>
                                    {deliveryPartners.map(dp => <option key={dp.id} value={dp.name}>{dp.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Tracking ID / AWB</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    value={viewOrder.trackingId || ''}
                                    onChange={(e) => handleViewFieldChange('trackingId', e.target.value)}
                                    placeholder="Enter tracking ID"
                                />
                                {viewOrder.trackingId && (() => {
                                    const tLink = viewOrder.trackingLink || '';
                                    const isWa = tLink.includes('wa.me') || tLink.includes('whatsapp');
                                    // If tracking link is a WhatsApp link, open it directly
                                    // Otherwise send a WhatsApp message to the customer with tracking info
                                    const href = isWa
                                        ? tLink
                                        : `https://wa.me/${getCustomerById(viewOrder.customerId)?.phone}?text=${encodeURIComponent(`Your order has been dispatched on ${new Date(viewOrder.shippedDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')} Via ${viewOrder.deliveryPartner || 'Courier'}. Use tracking ID [${viewOrder.trackingId}] to follow your delivery using link [${tLink || 'https://snahorganics.com'}]. Thanks for choosing SNAH Organics.\nwww.snahorganics.com\n\nPlease Note ⚠️ : Opening video is must to claim the parcel issues.`)}`;
                                    return (
                                        <a href={href} target="_blank" rel="noopener noreferrer"
                                            className="btn btn-success" style={{ whiteSpace: 'nowrap' }}>
                                            <FiMessageCircle /> {isWa ? 'Open WhatsApp' : 'Notify'}
                                        </a>
                                    );
                                })()}
                            </div>
                            {(viewOrder.trackingId && viewOrder.status === 'pending') && (
                                <small style={{ color: 'var(--success-600)' }}>Status automatically set to Shipped on save.</small>
                            )}
                        </div>

                        {/* Order info */}
                        <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                            <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Customer:</span> <strong>{getCustomerById(viewOrder.customerId)?.name}</strong></div>
                            <div className="flex justify-between" style={{ marginBottom: '4px' }}><span>Phone:</span> <span className="font-mono">{getCustomerById(viewOrder.customerId)?.phone}</span></div>
                            <div className="flex justify-between"><span>Date:</span> <span>{formatDate(viewOrder.createdAt)}</span></div>
                            {viewOrder.closer_id && (
                                <div className="flex justify-between" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--gray-100)' }}>
                                    <span>Closed By:</span>
                                    <strong>{allUsers.find(u => u.id === viewOrder.closer_id)?.name || 'Unknown'}</strong>
                                </div>
                            )}
                        </div>

                        {viewOrder.status === 'returned' && viewOrder.returnReason && (
                            <div style={{ background: 'var(--danger-50)', border: '1px solid var(--danger-100)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--danger-700)' }}>
                                <strong>Return Reason:</strong> {viewOrder.returnReason}
                            </div>
                        )}

                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
                                <tbody>
                                    {viewOrder.items?.map((item, i) => (
                                        <tr key={i}>
                                            <td>{getProductById(item.productId)?.name}</td>
                                            <td>{item.quantity}</td>
                                            <td>{formatCurrency(item.price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', fontWeight: 600 }}>
                            <p>Subtotal: {formatCurrency(viewOrder.subtotal)}</p>
                            {Number(viewOrder.discount) > 0 && <p className="text-success">Discount: -{formatCurrency(viewOrder.discountType === 'percent' ? (viewOrder.subtotal * viewOrder.discount / 100) : viewOrder.discount)}</p>}
                            <p>GST: {formatCurrency(viewOrder.gstAmount)}</p>
                            <h3 style={{ fontSize: '1.25rem', color: 'var(--primary-700)', marginTop: '4px' }}>Total: {formatCurrency(viewOrder.total)}</h3>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
