import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiFilter } from 'react-icons/fi';

export default function CustomersPage() {
    const { customers, orders, products, hasPermission, getProductById, updateCustomer, deleteCustomer, addCustomerAsync, api } = useApp();
    const [search, setSearch] = useState('');
    const [filterProduct, setFilterProduct] = useState('all');
    const [filterType, setFilterType] = useState('all'); // 'all', 'repeated'
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'qty-asc', 'qty-desc', 'spent-desc'
    const [showAdd, setShowAdd] = useState(false);
    const [editCustomer, setEditCustomer] = useState(null);
    const [viewHistory, setViewHistory] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', address: '', area: '' });

    // Precalculate customer stats
    const customerStats = useMemo(() => {
        const stats = {};
        customers.forEach(c => {
            const cOrders = orders.filter(o => o.customerId === c.id);
            const totalSpent = cOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            let totalQty = 0;
            const boughtItems = new Set();

            cOrders.forEach(o => {
                if (o.status !== 'returned' && o.items) {
                    o.items.forEach(i => {
                        totalQty += i.quantity;
                        boughtItems.add(i.productId);
                    });
                }
            });

            stats[c.id] = {
                orderCount: cOrders.length,
                totalSpent,
                totalQty,
                boughtItems,
            };
        });
        return stats;
    }, [customers, orders]);

    const sortedFiltered = useMemo(() => {
        const q = search.toLowerCase();
        let list = customers.filter(c => {
            // Search
            if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q) && !(c.area || '').toLowerCase().includes(q)) return false;

            const stats = customerStats[c.id];

            // Filters
            if (filterType === 'repeated' && stats.orderCount < 2) return false;

            if (filterProduct !== 'all') {
                if (!stats.boughtItems.has(parseInt(filterProduct))) return false;
            }

            return true;
        });

        // Sort
        if (sortBy === 'newest') list.sort((a, b) => b.id - a.id);
        if (sortBy === 'qty-asc') list.sort((a, b) => customerStats[a.id].totalQty - customerStats[b.id].totalQty);
        if (sortBy === 'qty-desc') list.sort((a, b) => customerStats[b.id].totalQty - customerStats[a.id].totalQty);
        if (sortBy === 'spent-desc') list.sort((a, b) => customerStats[b.id].totalSpent - customerStats[a.id].totalSpent);

        return list;
    }, [customers, search, filterProduct, filterType, sortBy, customerStats]);

    const openAdd = () => {
        setForm({ name: '', phone: '', address: '', area: '' });
        setShowAdd(true);
    };

    const openEdit = (customer) => {
        setForm({ ...customer });
        setEditCustomer(customer);
    };

    const handleSave = async () => {
        if (!form.name || !form.phone) return;
        try {
            if (editCustomer) {
                const updated = await api(`/customers/${editCustomer.id}`, { method: 'PUT', body: form });
                updateCustomer(updated);
                setEditCustomer(null);
            } else {
                await addCustomerAsync(form);
                setShowAdd(false);
            }
            setForm({ name: '', phone: '', address: '', area: '' });
        } catch (err) {
            alert(err.message || 'Error saving customer');
        }
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            deleteCustomer(id);
        }
    };

    const customerOrders = viewHistory
        ? orders.filter((o) => o.customerId === viewHistory.id)
        : [];

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getPaymentBadge = (status) => {
        const map = { paid: 'badge-paid', not_paid: 'badge-unpaid', partial: 'badge-partial' };
        const labels = { paid: 'Paid', not_paid: 'Not Paid', partial: 'Partial' };
        return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
    };

    const formFields = (
        <>
            <div className="form-group">
                <label>Customer Name *</label>
                <input placeholder="Enter customer name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
                <label>Phone Number *</label>
                <input placeholder="e.g. +919876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="form-group">
                <label>Address</label>
                <input placeholder="Enter address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="form-group">
                <label>Area</label>
                <input placeholder="Enter area / city" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
        </>
    );

    return (
        <>
            <div className="card">
                <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
                    <div className="flex justify-between items-center w-full">
                        <h2>Customers ({sortedFiltered.length})</h2>
                        {hasPermission('addCustomer') && (
                            <button className="btn btn-primary" onClick={openAdd} id="add-customer-btn">
                                <FiPlus /> Add Customer
                            </button>
                        )}
                    </div>

                    <div className="crm-search-sort-row" style={{ marginTop: 0 }}>
                        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search name, phone, or area..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="customer-search"
                            />
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <select className="crm-input" style={{ minWidth: 140, marginBottom: 0 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value="all">👥 All Customers</option>
                                <option value="repeated">🔁 Repeated (&gt;1 order)</option>
                            </select>

                            <select className="crm-input" style={{ minWidth: 140, marginBottom: 0 }} value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
                                <option value="all">🛍️ Any Product</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>Bought: {p.name}</option>
                                ))}
                            </select>

                            <select className="crm-input" style={{ minWidth: 140, marginBottom: 0 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                <option value="newest">⬇ Newest</option>
                                <option value="spent-desc">💰 Highest Spent</option>
                                <option value="qty-desc">📈 Most Qty Bought</option>
                                <option value="qty-asc">📉 Least Qty Bought</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Phone & Area</th>
                                <th>Orders</th>
                                <th>Total Qty</th>
                                <th>Total Spent</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFiltered.map((c, i) => {
                                const stats = customerStats[c.id];
                                return (
                                    <tr key={c.id}>
                                        <td data-label="#">{i + 1}</td>
                                        <td data-label="Name" className="font-bold">{c.name}</td>
                                        <td data-label="Phone & Area">
                                            <div className="font-mono">{c.phone}</div>
                                            <div className="text-secondary" style={{ fontSize: '0.8rem' }}>{c.area}</div>
                                        </td>
                                        <td data-label="Orders">
                                            <span style={{ fontWeight: stats.orderCount > 1 ? 700 : 400, color: stats.orderCount > 1 ? 'var(--primary-600)' : 'inherit' }}>
                                                {stats.orderCount} {stats.orderCount > 1 ? ' (Repeated)' : ''}
                                            </span>
                                        </td>
                                        <td data-label="Total Qty">{stats.totalQty} items</td>
                                        <td data-label="Total Spent" className="font-bold">{formatCurrency(stats.totalSpent)}</td>
                                        <td data-label="Actions">
                                            <div className="flex gap-8">
                                                <a className="btn btn-secondary btn-sm btn-icon" href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                                                    💬
                                                </a>
                                                <button className="btn btn-secondary btn-sm btn-icon" title="View History" onClick={() => setViewHistory(c)}>
                                                    <FiEye size={14} />
                                                </button>
                                                {(hasPermission('addCustomer') || hasPermission('editAllCustomers')) && (
                                                    <>
                                                        <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEdit(c)}><FiEdit2 size={14} /></button>
                                                        <button className="btn btn-secondary btn-sm btn-icon" title="Delete" onClick={() => handleDelete(c.id)}><FiTrash2 size={14} /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedFiltered.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">👥</div>
                                            <h3>No customers found</h3>
                                            <p>Adjust your filters or add a new customer</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAdd && (
                <Modal title="Add Customer" onClose={() => setShowAdd(false)} footer={<><button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} id="save-customer-btn">Add Customer</button></>}>
                    {formFields}
                </Modal>
            )}

            {/* Edit Modal */}
            {editCustomer && (
                <Modal title="Edit Customer" onClose={() => setEditCustomer(null)} footer={<><button className="btn btn-secondary" onClick={() => setEditCustomer(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save Changes</button></>}>
                    {formFields}
                </Modal>
            )}

            {/* Order History Modal */}
            {viewHistory && (
                <Modal title={`Order History - ${viewHistory.name}`} onClose={() => setViewHistory(null)}>
                    {customerOrders.length === 0 ? (
                        <div className="empty-state"><p>No orders found for this customer</p></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Product Summary */}
                            {(() => {
                                const productTotals = {};
                                customerOrders.forEach(o => {
                                    if (o.status !== 'returned' && o.items) {
                                        o.items.forEach(item => {
                                            const prod = getProductById(item.productId);
                                            const name = prod?.name || `Product #${item.productId}`;
                                            productTotals[name] = (productTotals[name] || 0) + item.quantity;
                                        });
                                    }
                                });
                                const entries = Object.entries(productTotals);
                                if (entries.length === 0) return null;
                                return (
                                    <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '8px', color: 'var(--primary-700)' }}>📦 Products Ordered (Total)</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {entries.map(([name, qty]) => (
                                                <span key={name} style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    {name} × {qty}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Products</th>
                                            <th>Total</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerOrders.map((o) => (
                                            <tr key={o.id}>
                                                <td className="font-mono">{o.id}</td>
                                                <td>
                                                    {o.items.map((item) => {
                                                        const prod = getProductById(item.productId);
                                                        return prod ? `${prod.name} x${item.quantity}` : '';
                                                    }).filter(Boolean).join(', ')}
                                                </td>
                                                <td className="font-bold">{formatCurrency(o.total)}</td>
                                                <td>{getPaymentBadge(o.paymentStatus)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </>
    );
}
