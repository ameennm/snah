import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiTrash2, FiEye, FiUserCheck, FiUserPlus, FiDollarSign } from 'react-icons/fi';

export default function OrdersPage() {
    const { orders, customers, products, hasPermission, getCustomerById, getProductById, user, addCustomer, addCustomerAsync, addOrder, updateOrder, deleteOrder } = useApp();
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [viewOrder, setViewOrder] = useState(null);
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [showPaymentModal, setShowPaymentModal] = useState(null);
    const [paymentInput, setPaymentInput] = useState('');

    // Customer inline form
    const [customerName, setCustomerName] = useState('');
    const [countryCode, setCountryCode] = useState('91');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerArea, setCustomerArea] = useState('');

    // Order items
    const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1 }]);
    const [paymentStatus, setPaymentStatus] = useState('not_paid');
    const [initialPaidAmount, setInitialPaidAmount] = useState('');

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
            const customer = getCustomerById(o.customerId);
            const matchesSearch =
                o.id.toLowerCase().includes(search.toLowerCase()) ||
                (customer?.name || '').toLowerCase().includes(search.toLowerCase());
            const matchesPayment =
                paymentFilter === 'all' || o.paymentStatus === paymentFilter;
            return matchesSearch && matchesPayment;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
        return { subtotal, gstTotal, total: subtotal + gstTotal };
    };

    const resetForm = () => {
        setCustomerName(''); setCustomerPhone(''); setCountryCode('91');
        setCustomerAddress(''); setCustomerArea('');
        setOrderItems([{ productId: '', quantity: 1 }]);
        setPaymentStatus('not_paid'); setInitialPaidAmount('');
        setShowCreate(false);
    };

    const handleCreateOrder = async () => {
        const validItems = orderItems.filter((i) => i.productId && i.quantity > 0);
        if (!customerName || !customerPhone || validItems.length === 0) return;

        const items = validItems.map((i) => {
            const product = getProductById(Number(i.productId));
            return { productId: Number(i.productId), quantity: Number(i.quantity), price: product.sellingPrice, gst: product.gst };
        });

        const { subtotal, gstTotal, total } = calculateOrderTotal();
        const paidAmount = paymentStatus === 'paid' ? total : (paymentStatus === 'partial' ? Number(initialPaidAmount) || 0 : 0);

        try {
            // Determine customer ID (wait for real ID if creating a new customer)
            let customerId;
            if (matchedCustomer) {
                customerId = matchedCustomer.id;
            } else {
                // Must use the async version here to get the real DB ID before creating the order
                const realCustomer = await addCustomerAsync({
                    name: customerName, phone: fullPhone,
                    address: customerAddress, area: customerArea,
                });
                customerId = realCustomer.id;
            }

            // Await the order validation
            await addOrder({
                customerId, items, subtotal, gstAmount: gstTotal, total,
                paymentStatus, paidAmount, createdBy: user.id,
            });

            // Close and reset form only upon success
            resetForm();
        } catch (error) {
            console.error(error);
            alert('Failed to save order. This may be due to a poor connection or invalid data. Please try again.');
        }
    };

    const handleStatusChange = (orderId, newStatus) => {
        const order = orders.find(o => o.id === orderId);
        const data = { status: newStatus };
        if (newStatus === 'returned' && order?.status !== 'returned') {
            data.restoreStock = true;
        }
        updateOrder(orderId, data);
        if (viewOrder && viewOrder.id === orderId) setViewOrder({ ...viewOrder, status: newStatus });
    };

    const handlePaymentChange = (orderId, newPayment) => {
        const order = orders.find(o => o.id === orderId);
        const data = { paymentStatus: newPayment };
        if (newPayment === 'paid') {
            data.paidAmount = order?.total || 0;
        } else if (newPayment === 'not_paid') {
            data.paidAmount = 0;
        }
        if (newPayment === 'partial') {
            setShowPaymentModal(order);
            setPaymentInput(String(order?.paidAmount || ''));
            return;
        }
        updateOrder(orderId, data);
        if (viewOrder && viewOrder.id === orderId) setViewOrder({ ...viewOrder, paymentStatus: newPayment, paidAmount: data.paidAmount });
    };

    const handleAddPayment = () => {
        if (!showPaymentModal || !paymentInput) return;
        const newPaidAmount = Number(paymentInput);
        if (isNaN(newPaidAmount) || newPaidAmount < 0) return;

        const order = showPaymentModal;
        const finalPaid = newPaidAmount;
        const newStatus = finalPaid >= order.total ? 'paid' : (finalPaid > 0 ? 'partial' : 'not_paid');

        updateOrder(order.id, { paidAmount: finalPaid, paymentStatus: newStatus });
        if (viewOrder && viewOrder.id === order.id) {
            setViewOrder({ ...viewOrder, paidAmount: finalPaid, paymentStatus: newStatus });
        }
        setShowPaymentModal(null);
        setPaymentInput('');
    };

    const handleDeleteOrder = (orderId) => {
        if (window.confirm('Are you sure you want to delete this order? Stock will be restored.')) {
            deleteOrder(orderId);
            setViewOrder(null);
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

    const getPaymentBadge = (status) => {
        const map = { paid: 'badge-paid', not_paid: 'badge-unpaid', partial: 'badge-partial' };
        const labels = { paid: 'Paid', not_paid: 'Not Paid', partial: 'Partial' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    const getStatusBadge = (status) => {
        const map = { pending: 'badge-pending', shipped: 'badge-shipped', delivered: 'badge-delivered', returned: 'badge-returned' };
        const labels = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered', returned: 'Returned' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    const { subtotal, gstTotal, total } = calculateOrderTotal();

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>Orders ({filtered.length})</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} id="order-search" />
                        </div>
                        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ maxWidth: '160px' }}>
                            <option value="all">All Payments</option>
                            <option value="paid">Paid</option>
                            <option value="not_paid">Not Paid</option>
                            <option value="partial">Partial</option>
                        </select>
                        {hasPermission('createOrder') && (
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-order-btn">
                                <FiPlus /> New Order
                            </button>
                        )}
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Total</th>
                                <th>Paid</th>
                                <th>Due</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((order) => {
                                const customer = getCustomerById(order.customerId);
                                const paidAmt = order.paidAmount || 0;
                                const dueAmt = Math.max(0, order.total - paidAmt);
                                return (
                                    <tr key={order.id} style={order.status === 'returned' ? { opacity: 0.6, textDecoration: 'line-through' } : {}}>
                                        <td data-label="Order ID" className="font-mono font-bold">{order.id}</td>
                                        <td data-label="Customer">{customer?.name || 'Unknown'}</td>
                                        <td data-label="Total" className="font-bold">{formatCurrency(order.total)}</td>
                                        <td data-label="Paid" className="text-success font-bold">{formatCurrency(paidAmt)}</td>
                                        <td data-label="Due" className={dueAmt > 0 ? 'text-danger font-bold' : 'text-success font-bold'}>{formatCurrency(dueAmt)}</td>
                                        <td data-label="Payment">
                                            <div className="flex items-center gap-8">
                                                <select
                                                    value={order.paymentStatus}
                                                    onChange={(e) => handlePaymentChange(order.id, e.target.value)}
                                                    className={`status-select ${order.paymentStatus === 'paid' ? 'status-paid' : order.paymentStatus === 'partial' ? 'status-partial' : 'status-unpaid'}`}
                                                    disabled={order.status === 'returned'}
                                                >
                                                    <option value="paid">Paid</option>
                                                    <option value="not_paid">Not Paid</option>
                                                    <option value="partial">Partial</option>
                                                </select>
                                                {order.paymentStatus === 'partial' && (
                                                    <button
                                                        className="btn btn-secondary btn-sm btn-icon"
                                                        title="Add Payment"
                                                        onClick={() => { setShowPaymentModal(order); setPaymentInput(String(order.paidAmount || 0)); }}
                                                    >
                                                        <FiDollarSign size={14} />
                                                    </button>
                                                )}
                                            </div>
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
                                        <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>{formatDate(order.createdAt)}</td>
                                        <td data-label="Actions">
                                            <div className="flex gap-8">
                                                <button className="btn btn-secondary btn-sm btn-icon" title="View" onClick={() => setViewOrder(order)}>
                                                    <FiEye size={14} />
                                                </button>
                                                {hasPermission('createOrder') && (
                                                    <button className="btn btn-secondary btn-sm btn-icon" title="Delete" onClick={() => handleDeleteOrder(order.id)}>
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={9}>
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
            </div>

            {/* ===== Add Payment Modal ===== */}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                            <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                                <span className="text-muted">Order Total</span>
                                <span className="font-bold">{formatCurrency(showPaymentModal.total)}</span>
                            </div>
                            <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                                <span className="text-muted">Previously Paid</span>
                                <span className="text-success font-bold">{formatCurrency(showPaymentModal.paidAmount || 0)}</span>
                            </div>
                            <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                                <span className="text-muted">Balance Due</span>
                                <span className="text-danger font-bold">{formatCurrency(Math.max(0, showPaymentModal.total - (showPaymentModal.paidAmount || 0)))}</span>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Total Paid Amount (₹)</label>
                            <input
                                type="number"
                                placeholder="Enter total amount received so far"
                                value={paymentInput}
                                onChange={(e) => setPaymentInput(e.target.value)}
                                min="0"
                                max={showPaymentModal.total}
                                autoFocus
                                style={{ fontSize: '1.125rem', fontWeight: 700, padding: '14px' }}
                            />
                            <small style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                Enter the total amount received so far including previous payments
                            </small>
                        </div>
                        {paymentInput && Number(paymentInput) > 0 && (
                            <div style={{ background: Number(paymentInput) >= showPaymentModal.total ? 'var(--success-50)' : 'var(--warning-50)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600 }}>
                                {Number(paymentInput) >= showPaymentModal.total
                                    ? '✅ Full payment received — status will change to Paid'
                                    : `⏳ Remaining: ${formatCurrency(showPaymentModal.total - Number(paymentInput))}`
                                }
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* ===== Create Order Modal ===== */}
            {showCreate && (
                <Modal
                    title="Create New Order"
                    onClose={resetForm}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateOrder}
                                disabled={!customerName || !customerPhone || orderItems.filter(i => i.productId).length === 0} id="submit-order-btn">
                                Create Order — {formatCurrency(total)}
                            </button>
                        </>
                    }
                >
                    {/* Customer Section */}
                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {matchedCustomer ? (
                                <><FiUserCheck style={{ color: 'var(--success-600)' }} /> Existing Customer</>
                            ) : customerPhone.length >= 5 ? (
                                <><FiUserPlus style={{ color: 'var(--primary-600)' }} /> New Customer</>
                            ) : '👤 Customer Details'}
                        </h3>
                        {matchedCustomer && (
                            <div style={{ background: 'var(--success-50)', border: '1px solid var(--success-100)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '12px', fontSize: '0.8125rem', color: 'var(--success-700)' }}>
                                ✓ Customer found: <strong>{matchedCustomer.name}</strong> — {matchedCustomer.area}
                            </div>
                        )}
                        <div className="form-group">
                            <label>Customer Name *</label>
                            <input placeholder="Enter customer name" value={matchedCustomer ? matchedCustomer.name : customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={!!matchedCustomer} />
                        </div>
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label>Phone Number *</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" placeholder="91" value={countryCode} onChange={(e) => setCountryCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} style={{ maxWidth: '70px', textAlign: 'center', fontWeight: 600 }} />
                                <input type="tel" placeholder="Enter phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))} style={{ flex: 1 }} />
                            </div>
                        </div>
                        {!matchedCustomer && customerPhone.length >= 5 && (
                            <div className="form-row" style={{ marginTop: '12px' }}>
                                <div className="form-group"><label>Address</label><input placeholder="Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} /></div>
                                <div className="form-group"><label>Area / City</label><input placeholder="Area" value={customerArea} onChange={(e) => setCustomerArea(e.target.value)} /></div>
                            </div>
                        )}
                    </div>

                    {/* Items Section */}
                    <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px' }}>📦 Order Items</h3>
                        {orderItems.map((item, index) => {
                            const product = item.productId ? getProductById(Number(item.productId)) : null;
                            return (
                                <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                        {index === 0 && <label>Product</label>}
                                        <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)}>
                                            <option value="">Select product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>{p.name} — ₹{p.sellingPrice} (Stock: {p.stock})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 0.7, marginBottom: 0 }}>
                                        {index === 0 && <label>Qty</label>}
                                        <input type="number" min="1" max={product?.stock || 999} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                                    </div>
                                    <div style={{ flex: 0.8, textAlign: 'right', paddingBottom: '8px' }}>
                                        {product && <span className="font-bold">{formatCurrency(product.sellingPrice * Number(item.quantity || 0))}</span>}
                                    </div>
                                    {orderItems.length > 1 && (
                                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => removeItem(index)} style={{ marginBottom: '4px' }}>
                                            <FiTrash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: '4px' }}><FiPlus size={14} /> Add Item</button>
                    </div>

                    {/* Summary */}
                    <div style={{ marginTop: '20px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted">GST</span><span>{formatCurrency(gstTotal)}</span></div>
                        <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px', fontWeight: 700, fontSize: '1.0625rem' }}>
                            <span>Total</span><span style={{ color: 'var(--primary-700)' }}>{formatCurrency(total)}</span>
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label>Payment Status</label>
                        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                            <option value="not_paid">Not Paid</option>
                            <option value="paid">Paid</option>
                            <option value="partial">Partial</option>
                        </select>
                    </div>
                    {paymentStatus === 'partial' && (
                        <div className="form-group" style={{ marginTop: '8px' }}>
                            <label>Amount Received (₹)</label>
                            <input type="number" placeholder="Enter amount received" value={initialPaidAmount} onChange={(e) => setInitialPaidAmount(e.target.value)} min="0" max={total} />
                        </div>
                    )}
                </Modal>
            )}

            {/* ===== View Order Modal ===== */}
            {viewOrder && (
                <Modal
                    title={`Order ${viewOrder.id}`}
                    onClose={() => setViewOrder(null)}
                    footer={
                        <>
                            {hasPermission('createOrder') && (
                                <button className="btn btn-danger" onClick={() => handleDeleteOrder(viewOrder.id)}>
                                    <FiTrash2 size={14} /> Delete Order
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setViewOrder(null)}>Close</button>
                        </>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="flex justify-between"><span className="text-muted">Customer</span><span className="font-bold">{getCustomerById(viewOrder.customerId)?.name || 'Unknown'}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Phone</span><span className="font-mono">{getCustomerById(viewOrder.customerId)?.phone || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Date</span><span>{formatDate(viewOrder.createdAt)}</span></div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted">Status</span>
                            <select value={viewOrder.status} onChange={(e) => handleStatusChange(viewOrder.id, e.target.value)} style={{ maxWidth: '140px', padding: '6px 10px', fontSize: '0.8125rem' }}>
                                <option value="pending">Pending</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="returned">Returned</option>
                            </select>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted">Payment</span>
                            <select value={viewOrder.paymentStatus} onChange={(e) => handlePaymentChange(viewOrder.id, e.target.value)} style={{ maxWidth: '140px', padding: '6px 10px', fontSize: '0.8125rem' }} disabled={viewOrder.status === 'returned'}>
                                <option value="paid">Paid</option>
                                <option value="not_paid">Not Paid</option>
                                <option value="partial">Partial</option>
                            </select>
                        </div>

                        {/* Payment progress */}
                        <div style={{ background: 'var(--gray-50)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                            <div className="flex justify-between" style={{ marginBottom: '6px' }}>
                                <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Paid</span>
                                <span className="text-success font-bold">{formatCurrency(viewOrder.paidAmount || 0)}</span>
                            </div>
                            <div className="flex justify-between" style={{ marginBottom: '8px' }}>
                                <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Due</span>
                                <span className="text-danger font-bold">{formatCurrency(Math.max(0, viewOrder.total - (viewOrder.paidAmount || 0)))}</span>
                            </div>
                            <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, ((viewOrder.paidAmount || 0) / viewOrder.total) * 100)}%`, background: (viewOrder.paidAmount || 0) >= viewOrder.total ? 'var(--success-500)' : 'var(--warning-500)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                            </div>
                            {viewOrder.paymentStatus === 'partial' && viewOrder.status !== 'returned' && (
                                <button className="btn btn-success btn-sm" style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
                                    onClick={() => { setShowPaymentModal(viewOrder); setPaymentInput(String(viewOrder.paidAmount || 0)); }}>
                                    <FiDollarSign size={14} /> Add Payment
                                </button>
                            )}
                        </div>

                        {viewOrder.trackingId && (
                            <div className="flex justify-between"><span className="text-muted">Tracking</span><span className="font-mono">{viewOrder.trackingId}</span></div>
                        )}

                        {viewOrder.status === 'returned' && (
                            <div style={{ background: 'var(--danger-50)', border: '1px solid var(--danger-100)', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--danger-600)', fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>
                                🔄 This order has been returned. Stock has been restored.
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>ITEMS</h4>
                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
                                <tbody>
                                    {viewOrder.items?.map((item, i) => {
                                        const prod = getProductById(item.productId);
                                        const lineGst = (item.price * item.quantity * item.gst) / 100;
                                        return (
                                            <tr key={i}>
                                                <td className="font-bold">{prod?.name || 'Unknown'}</td>
                                                <td>{item.quantity}</td>
                                                <td>{formatCurrency(item.price)}</td>
                                                <td>{formatCurrency(lineGst)}</td>
                                                <td className="font-bold">{formatCurrency(item.price * item.quantity + lineGst)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatCurrency(viewOrder.subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted">GST</span><span>{formatCurrency(viewOrder.gstAmount)}</span></div>
                        <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px', fontWeight: 700, fontSize: '1.125rem' }}>
                            <span>Grand Total</span><span style={{ color: 'var(--primary-700)' }}>{formatCurrency(viewOrder.total)}</span>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
