import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function ProductsPage() {
    const { products, hasPermission, addProduct, updateProduct, deleteProduct } = useApp();
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [form, setForm] = useState({
        name: '',
        sellingPrice: '',
        gst: '',
        stock: '',
    });

    const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => {
        setForm({ name: '', sellingPrice: '', gst: '', stock: '' });
        setShowAdd(true);
    };

    const openEdit = (product) => {
        setForm({
            name: product.name,
            sellingPrice: String(product.sellingPrice),
            gst: String(product.gst),
            stock: String(product.stock),
        });
        setEditProduct(product);
    };

    const handleSave = () => {
        if (!form.name || !form.sellingPrice) return;
        const data = {
            name: form.name,
            sellingPrice: Number(form.sellingPrice),
            gst: Number(form.gst) || 0,
            stock: Number(form.stock) || 0,
        };
        if (editProduct) {
            updateProduct({ ...data, id: editProduct.id });
            setEditProduct(null);
        } else {
            addProduct(data);
            setShowAdd(false);
        }
        setForm({ name: '', sellingPrice: '', gst: '', stock: '' });
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            deleteProduct(id);
        }
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formFields = (
        <>
            <div className="form-group">
                <label>Product Name *</label>
                <input
                    placeholder="Enter product name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                />
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label>Selling Price *</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={form.sellingPrice}
                        onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                        required
                    />
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label>GST %</label>
                    <input
                        type="number"
                        placeholder="e.g. 5, 12, 18"
                        value={form.gst}
                        onChange={(e) => setForm({ ...form, gst: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label>Stock Quantity</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={form.stock}
                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    />
                </div>
            </div>
        </>
    );

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h2>Products ({filtered.length})</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="product-search"
                            />
                        </div>
                        {hasPermission('addProduct') && (
                            <button className="btn btn-primary" onClick={openAdd} id="add-product-btn">
                                <FiPlus /> Add Product
                            </button>
                        )}
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Product Name</th>
                                <th>Selling Price</th>
                                <th>GST %</th>
                                <th>Stock</th>
                                {hasPermission('editStock') && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p, i) => (
                                <tr key={p.id}>
                                    <td data-label="#">{i + 1}</td>
                                    <td data-label="Product" className="font-bold">{p.name}</td>
                                    <td data-label="Selling">{formatCurrency(p.sellingPrice)}</td>
                                    <td data-label="GST">{p.gst}%</td>
                                    <td data-label="Stock">
                                        <span
                                            className={`badge ${p.stock <= 10 ? 'badge-low-stock' : 'badge-in-stock'}`}
                                        >
                                            {p.stock}
                                        </span>
                                    </td>
                                    {hasPermission('editStock') && (
                                        <td data-label="Actions">
                                            <div className="flex gap-8">
                                                <button
                                                    className="btn btn-secondary btn-sm btn-icon"
                                                    title="Edit"
                                                    onClick={() => openEdit(p)}
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm btn-icon"
                                                    title="Delete"
                                                    onClick={() => handleDelete(p.id)}
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={hasPermission('editStock') ? 8 : 7}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📦</div>
                                            <h3>No products found</h3>
                                            <p>Add products to your inventory</p>
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
                    title="Add Product"
                    onClose={() => setShowAdd(false)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSave} id="save-product-btn">
                                Add Product
                            </button>
                        </>
                    }
                >
                    {formFields}
                </Modal>
            )}

            {/* Edit Modal */}
            {editProduct && (
                <Modal
                    title="Edit Product"
                    onClose={() => setEditProduct(null)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setEditProduct(null)}>
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
        </>
    );
}
