import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiTrash2, FiEye, FiUserCheck, FiUserPlus } from 'react-icons/fi';

export default function OrdersPage() {
    const { orders, customers, products, dispatch, hasPermission, getCustomerById, getProductById, user } = useApp();
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [viewOrder, setViewOrder] = useState(null);
    const [paymentFilter, setPaymentFilter] = useState('all');

    // Customer inline form (not separate dropdown)
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerArea, setCustomerArea] = useState('');

    // Order items
    const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1 }]);
    const [paymentStatus, setPaymentStatus] = useState('not_paid');

    // Auto-match customer by phone
    const matchedCustomer = useMemo(() => {
        if (!customerPhone || customerPhone.length < 5) return null;
        const cleaned = customerPhone.replace(/[^0-9]/g, '');
        return customers.find((c) => c.phone.replace(/[^0-9]/g, '') === cleaned);
    }, [customerPhone, customers]);

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

    const addItem = () => {
        setOrderItems([...orderItems, { productId: '', quantity: 1 }]);
    };

    const removeItem = (index) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const updateItem = (index, field, value) => {
        const updated = [...orderItems];
        updated[index] = { ...updated[index], [field]: value };
        setOrderItems(updated);
    };

    const calculateOrderTotal = () => {
        let subtotal = 0;
        let gstTotal = 0;
        orderItems.forEach((item) => {
            const product = getProductById(Number(item.productId));
            if (product) {
                const lineTotal = product.sellingPrice * item.quantity;
                const lineGst = (lineTotal * product.gst) / 100;
                subtotal += lineTotal;
                gstTotal += lineGst;
            }
        });
        return { subtotal, gstTotal, total: subtotal + gstTotal };
    };

    const resetForm = () => {
        setShowCreate(false);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setCustomerArea('');
        setOrderItems([{ productId: '', quantity: 1 }]);
        setPaymentStatus('not_paid');
    };

    const handleCreateOrder = () => {
        const validItems = orderItems.filter((i) => i.productId && i.quantity > 0);
        if (!customerName || !customerPhone || validItems.length === 0) return;

        // Resolve customer: use matched or create new
        let customerId;
        if (matchedCustomer) {
            customerId = matchedCustomer.id;
        } else {
            // Create new customer via dispatch, compute the ID
            const newId = Math.max(0, ...customers.map((c) => c.id)) + 1;
            dispatch({
                type: 'ADD_CUSTOMER',
                payload: {
                    name: customerName,
                    phone: customerPhone.replace(/[^0-9]/g, ''),
                    address: customerAddress,
                    area: customerArea,
                },
            });
            customerId = newId;
        }

        const items = validItems.map((i) => {
            const product = getProductById(Number(i.productId));
            return {
                productId: Number(i.productId),
                quantity: Number(i.quantity),
                price: product.sellingPrice,
                gst: product.gst,
            };
        });

        const { subtotal, gstTotal, total } = calculateOrderTotal();

        dispatch({
            type: 'ADD_ORDER',
            payload: {
                customerId,
                items,
                subtotal,
                gstAmount: gstTotal,
                total,
                paymentStatus,
                trackingId: '',
                status: 'pending',
                createdAt: new Date().toISOString(),
                createdBy: user.id,
            },
        });

        resetForm();
    };

    const handleStatusChange = (orderId, newStatus) => {
        dispatch({ type: 'UPDATE_ORDER', payload: { id: orderId, status: newStatus } });
        // Also update viewOrder if it's open
        if (viewOrder && viewOrder.id === orderId) {
            setViewOrder({ ...viewOrder, status: newStatus });
        }
    };

    const handlePaymentChange = (orderId, newPayment) => {
        dispatch({ type: 'UPDATE_ORDER', payload: { id: orderId, paymentStatus: newPayment } });
        if (viewOrder && viewOrder.id === orderId) {
            setViewOrder({ ...viewOrder, paymentStatus: newPayment });
        }
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getPaymentBadge = (status) => {
        const map = { paid: 'badge-paid', not_paid: 'badge-unpaid', partial: 'badge-partial' };
        const labels = { paid: 'Paid', not_paid: 'Not Paid', partial: 'Partial' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
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

    const orderTotals = calculateOrderTotal();

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>Orders ({filtered.length})</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search orders..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="order-search"
                            />
                        </div>
                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            style={{ maxWidth: '160px' }}
                        >
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
                                <th>Items</th>
                                <th>Subtotal</th>
                                <th>GST</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((order) => {
                                const customer = getCustomerById(order.customerId);
                                return (
                                    <tr key={order.id}>
                                        <td className="font-mono font-bold">{order.id}</td>
                                        <td>{customer?.name || 'Unknown'}</td>
                                        <td>{order.items.length} item(s)</td>
                                        <td>{formatCurrency(order.subtotal)}</td>
                                        <td>{formatCurrency(order.gstAmount)}</td>
                                        <td className="font-bold">{formatCurrency(order.total)}</td>
                                        <td>
                                            <select
                                                value={order.paymentStatus}
                                                onChange={(e) => handlePaymentChange(order.id, e.target.value)}
                                                className={`badge ${order.paymentStatus === 'paid' ? 'badge-paid' : order.paymentStatus === 'partial' ? 'badge-partial' : 'badge-unpaid'}`}
                                                style={{ cursor: 'pointer', padding: '4px 8px', border: 'none', fontSize: '0.75rem', fontWeight: 600, borderRadius: '9999px', appearance: 'none', WebkitAppearance: 'none', backgroundImage: 'none', textAlign: 'center', minWidth: '80px' }}
                                            >
                                                <option value="paid">Paid</option>
                                                <option value="not_paid">Not Paid</option>
                                                <option value="partial">Partial</option>
                                            </select>
                                        </td>
                                        <td>
                                            <select
                                                value={order.status}
                                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                className={`badge ${order.status === 'delivered' ? 'badge-delivered' : order.status === 'shipped' ? 'badge-shipped' : 'badge-pending'}`}
                                                style={{ cursor: 'pointer', padding: '4px 8px', border: 'none', fontSize: '0.75rem', fontWeight: 600, borderRadius: '9999px', appearance: 'none', WebkitAppearance: 'none', backgroundImage: 'none', textAlign: 'center', minWidth: '80px' }}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="shipped">Shipped</option>
                                                <option value="delivered">Delivered</option>
                                            </select>
                                        </td>
                                        <td>
                                            {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                            })}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-secondary btn-sm btn-icon"
                                                title="View Details"
                                                onClick={() => setViewOrder(order)}
                                            >
                                                <FiEye size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={10}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">🛒</div>
                                            <h3>No orders found</h3>
                                            <p>Create your first order to get started</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Order Modal */}
            {showCreate && (
                <Modal
                    title="Create New Order"
                    onClose={resetForm}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={resetForm}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleCreateOrder} id="submit-order-btn">
                                Create Order
                            </button>
                        </>
                    }
                >
                    {/* ====== CUSTOMER SECTION ====== */}
                    <label style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Customer Details
                    </label>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Customer Name *</label>
                            <input
                                placeholder="Enter customer name"
                                value={matchedCustomer ? matchedCustomer.name : customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                disabled={!!matchedCustomer}
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone Number *</label>
                            <input
                                placeholder="e.g. 919876543210"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Auto-match indicator */}
                    {customerPhone.length >= 5 && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                background: matchedCustomer ? 'var(--success-50)' : 'var(--primary-50)',
                                color: matchedCustomer ? 'var(--success-700)' : 'var(--primary-700)',
                                border: `1px solid ${matchedCustomer ? 'var(--success-100)' : 'var(--primary-100)'}`,
                            }}
                        >
                            {matchedCustomer ? (
                                <>
                                    <FiUserCheck size={16} />
                                    Existing customer: <strong>{matchedCustomer.name}</strong> — {matchedCustomer.area}
                                </>
                            ) : (
                                <>
                                    <FiUserPlus size={16} />
                                    New customer will be created automatically
                                </>
                            )}
                        </div>
                    )}

                    {/* Extra fields only for new customers */}
                    {!matchedCustomer && (
                        <div className="form-row">
                            <div className="form-group">
                                <label>Address</label>
                                <input
                                    placeholder="Enter address"
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Area / City</label>
                                <input
                                    placeholder="Enter area"
                                    value={customerArea}
                                    onChange={(e) => setCustomerArea(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* ====== ORDER ITEMS ====== */}
                    <label style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                        Order Items
                    </label>

                    {orderItems.map((item, index) => {
                        const product = getProductById(Number(item.productId));
                        return (
                            <div
                                key={index}
                                style={{
                                    background: 'var(--gray-50)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '16px',
                                    border: '1px solid var(--border-light)',
                                }}
                            >
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Product</label>
                                        <select
                                            value={item.productId}
                                            onChange={(e) => updateItem(index, 'productId', e.target.value)}
                                        >
                                            <option value="">Select product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                                    {p.name} (Stock: {p.stock})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Quantity</label>
                                        <div className="flex gap-8 items-center">
                                            <input
                                                type="number"
                                                min="1"
                                                max={product?.stock || 999}
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                            />
                                            {orderItems.length > 1 && (
                                                <button
                                                    className="btn btn-danger btn-sm btn-icon"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {product && (
                                    <div style={{ marginTop: '8px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                        Price: {formatCurrency(product.sellingPrice)} | GST: {product.gst}% |
                                        Line Total: {formatCurrency(product.sellingPrice * item.quantity + (product.sellingPrice * item.quantity * product.gst / 100))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button className="btn btn-secondary" onClick={addItem}>
                        <FiPlus /> Add Another Item
                    </button>

                    <div className="form-group">
                        <label>Payment Status</label>
                        <select
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                        >
                            <option value="paid">Paid</option>
                            <option value="not_paid">Not Paid</option>
                            <option value="partial">Partial</option>
                        </select>
                    </div>

                    {/* Order Total */}
                    <div
                        style={{
                            background: 'var(--primary-50)',
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--primary-100)',
                        }}
                    >
                        <div className="flex justify-between" style={{ marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                            <span className="font-bold">{formatCurrency(orderTotals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between" style={{ marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>GST:</span>
                            <span className="font-bold">{formatCurrency(orderTotals.gstTotal)}</span>
                        </div>
                        <div
                            className="flex justify-between"
                            style={{
                                borderTop: '1px solid var(--primary-200)',
                                paddingTop: '8px',
                                fontSize: '1.125rem',
                            }}
                        >
                            <span className="font-bold">Total:</span>
                            <span className="font-bold" style={{ color: 'var(--primary-700)' }}>
                                {formatCurrency(orderTotals.total)}
                            </span>
                        </div>
                    </div>
                </Modal>
            )}

            {/* View Order Detail Modal */}
            {viewOrder && (
                <Modal
                    title={`Order ${viewOrder.id}`}
                    onClose={() => setViewOrder(null)}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="flex justify-between">
                            <span className="text-muted">Customer</span>
                            <span className="font-bold">{getCustomerById(viewOrder.customerId)?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Phone</span>
                            <span className="font-mono">{getCustomerById(viewOrder.customerId)?.phone}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Date</span>
                            <span>{new Date(viewOrder.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted">Payment</span>
                            <select
                                value={viewOrder.paymentStatus}
                                onChange={(e) => handlePaymentChange(viewOrder.id, e.target.value)}
                                style={{ maxWidth: '140px', padding: '6px 10px', fontSize: '0.8125rem' }}
                            >
                                <option value="paid">Paid</option>
                                <option value="not_paid">Not Paid</option>
                                <option value="partial">Partial</option>
                            </select>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted">Status</span>
                            <select
                                value={viewOrder.status}
                                onChange={(e) => handleStatusChange(viewOrder.id, e.target.value)}
                                style={{ maxWidth: '140px', padding: '6px 10px', fontSize: '0.8125rem' }}
                            >
                                <option value="pending">Pending</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                            </select>
                        </div>
                        {viewOrder.trackingId && (
                            <div className="flex justify-between">
                                <span className="text-muted">Tracking ID</span>
                                <span className="font-mono">{viewOrder.trackingId}</span>
                            </div>
                        )}
                    </div>

                    <div className="table-container" style={{ marginTop: '12px' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>GST</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewOrder.items.map((item, i) => {
                                    const product = getProductById(item.productId);
                                    const lineTotal = item.price * item.quantity;
                                    const lineGst = (lineTotal * item.gst) / 100;
                                    return (
                                        <tr key={i}>
                                            <td>{product?.name}</td>
                                            <td>{item.quantity}</td>
                                            <td>{formatCurrency(item.price)}</td>
                                            <td>{formatCurrency(lineGst)}</td>
                                            <td className="font-bold">{formatCurrency(lineTotal + lineGst)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div
                        style={{
                            background: 'var(--gray-50)',
                            padding: '16px',
                            borderRadius: 'var(--radius-md)',
                            marginTop: '8px',
                        }}
                    >
                        <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                            <span>Subtotal</span>
                            <span>{formatCurrency(viewOrder.subtotal)}</span>
                        </div>
                        <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                            <span>GST</span>
                            <span>{formatCurrency(viewOrder.gstAmount)}</span>
                        </div>
                        <div
                            className="flex justify-between font-bold"
                            style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px', fontSize: '1.0625rem' }}
                        >
                            <span>Grand Total</span>
                            <span>{formatCurrency(viewOrder.total)}</span>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
