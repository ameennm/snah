import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';

export default function CustomersPage() {
    const { customers, orders, hasPermission, getProductById, addCustomer, updateCustomer, deleteCustomer } = useApp();
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editCustomer, setEditCustomer] = useState(null);
    const [viewHistory, setViewHistory] = useState(null);
    const [form, setForm] = useState({ name: '', phone: '', address: '', area: '' });

    const filtered = customers.filter(
        (c) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone.includes(search) ||
            (c.area || '').toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => {
        setForm({ name: '', phone: '', address: '', area: '' });
        setShowAdd(true);
    };

    const openEdit = (customer) => {
        setForm({ ...customer });
        setEditCustomer(customer);
    };

    const handleSave = () => {
        if (!form.name || !form.phone) return;
        if (editCustomer) {
            updateCustomer({ ...editCustomer, ...form });
            setEditCustomer(null);
        } else {
            addCustomer(form);
            setShowAdd(false);
        }
        setForm({ name: '', phone: '', address: '', area: '' });
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
                <input
                    placeholder="Enter customer name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                />
            </div>
            <div className="form-group">
                <label>Phone Number *</label>
                <input
                    placeholder="e.g. 919876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                />
            </div>
            <div className="form-group">
                <label>Address</label>
                <input
                    placeholder="Enter address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
            </div>
            <div className="form-group">
                <label>Area</label>
                <input
                    placeholder="Enter area / city"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
            </div>
        </>
    );

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>Customers ({filtered.length})</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search customers..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="customer-search"
                            />
                        </div>
                        {hasPermission('addCustomer') && (
                            <button className="btn btn-primary" onClick={openAdd} id="add-customer-btn">
                                <FiPlus /> Add Customer
                            </button>
                        )}
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Address</th>
                                <th>Area</th>
                                <th>Orders</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => (
                                <tr key={c.id}>
                                    <td>{i + 1}</td>
                                    <td className="font-bold">{c.name}</td>
                                    <td className="font-mono">{c.phone}</td>
                                    <td>{c.address}</td>
                                    <td>{c.area}</td>
                                    <td>{orders.filter((o) => o.customerId === c.id).length}</td>
                                    <td>
                                        <div className="flex gap-8">
                                            <button
                                                className="btn btn-secondary btn-sm btn-icon"
                                                title="View History"
                                                onClick={() => setViewHistory(c)}
                                            >
                                                <FiEye size={14} />
                                            </button>
                                            {hasPermission('addCustomer') && (
                                                <>
                                                    <button
                                                        className="btn btn-secondary btn-sm btn-icon"
                                                        title="Edit"
                                                        onClick={() => openEdit(c)}
                                                    >
                                                        <FiEdit2 size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm btn-icon"
                                                        title="Delete"
                                                        onClick={() => handleDelete(c.id)}
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">👥</div>
                                            <h3>No customers found</h3>
                                            <p>Add your first customer to get started</p>
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
                <Modal
                    title="Add Customer"
                    onClose={() => setShowAdd(false)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} id="save-customer-btn">
                                Add Customer
                            </button>
                        </>
                    }
                >
                    {formFields}
                </Modal>
            )}

            {/* Edit Modal */}
            {editCustomer && (
                <Modal
                    title="Edit Customer"
                    onClose={() => setEditCustomer(null)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setEditCustomer(null)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                Save Changes
                            </button>
                        </>
                    }
                >
                    {formFields}
                </Modal>
            )}

            {/* Order History Modal */}
            {viewHistory && (
                <Modal
                    title={`Order History - ${viewHistory.name}`}
                    onClose={() => setViewHistory(null)}
                >
                    {customerOrders.length === 0 ? (
                        <div className="empty-state">
                            <p>No orders found for this customer</p>
                        </div>
                    ) : (
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
                    )}
                </Modal>
            )}
        </>
    );
}
