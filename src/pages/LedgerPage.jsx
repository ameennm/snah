import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiTrash2, FiEdit2, FiArrowUpRight, FiArrowDownLeft } from 'react-icons/fi';

export default function LedgerPage() {
    const { user, hasPermission, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, api } = useApp();
    const isAdmin = user?.role === 'super_admin';

    const [ledgerData, setLedgerData] = useState([]);
    const [totalLedger, setTotalLedger] = useState(0);

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [editEntry, setEditEntry] = useState(null); // null = adding new, otherwise editing existing

    // Pagination
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    useEffect(() => {
        const timer = setTimeout(async () => {
            const offset = (page - 1) * PAGE_SIZE;
            try {
                const res = await api(`/ledger?limit=${PAGE_SIZE}&offset=${offset}&search=${encodeURIComponent(search)}&type=${typeFilter}`);
                
                // If the user is an employee, filter locally as well just to be safe,
                // although the backend will see the user id in the JWT if auth is passed via cookies.
                // However, since we don't pass userId gracefully on GETs, we filter locally for employees.
                let list = res.results || [];
                if (!isAdmin) {
                    list = list.filter(entry => entry.createdBy === user?.id);
                }
                
                setLedgerData(list);
                setTotalLedger(isAdmin ? (res.total || 0) : list.length); 
                
            } catch (err) {
                console.error("Failed to fetch ledger", err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [api, page, search, typeFilter, isAdmin, user?.id]);

    const blankForm = {
        type: 'expense',
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        reference: '',
    };
    const [form, setForm] = useState(blankForm);

    const expenseCategories = [
        'Rent', 'Salary', 'Utilities', 'Shipping', 'Packaging',
        'Marketing', 'Maintenance', 'Office Supplies', 'Travel', 'Other',
    ];
    const incomeCategories = [
        'Sales', 'Refund Received', 'Interest', 'Commission', 'Other Income',
    ];

    // The data is now pre-filtered and sorted by the backend
    const filtered = ledgerData;

    const totalIncome = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const netBalance = totalIncome - totalExpense;
    const isFiltered = search || typeFilter !== 'all';

    // Running balance (chronological)
    const sortedForBalance = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const balanceMap = {};
    sortedForBalance.forEach((entry) => {
        runningBalance += entry.type === 'income' ? entry.amount : -entry.amount;
        balanceMap[entry.id] = runningBalance;
    });

    const openAdd = (type = 'expense') => {
        setForm({ ...blankForm, type });
        setEditEntry(null);
        setShowAdd(true);
    };

    const openEdit = (entry) => {
        setForm({
            type: entry.type,
            category: entry.category,
            description: entry.description,
            amount: String(entry.amount),
            date: entry.date,
            reference: entry.reference || '',
        });
        setEditEntry(entry);
        setShowAdd(true);
    };

    const closeModal = () => {
        setShowAdd(false);
        setEditEntry(null);
        setForm(blankForm);
    };

    const handleSave = () => {
        if (!form.category || !form.amount || !form.description) return;

        if (editEntry) {
            // Update existing entry
            updateLedgerEntry({
                ...editEntry,
                ...form,
                amount: Number(form.amount),
                updatedBy: user?.id,
            });
        } else {
            // Create new entry
            addLedgerEntry({
                ...form,
                amount: Number(form.amount),
                createdBy: user?.id,
            });
        }
        closeModal();
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this entry?')) {
            deleteLedgerEntry(id);
        }
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Can employee edit this entry? Only their own.
    const canEdit = (entry) => isAdmin || entry.createdBy === user?.id;

    const modalTitle = editEntry
        ? `Edit ${editEntry.type === 'income' ? 'Income' : 'Expense'}`
        : (form.type === 'income' ? 'Add Income' : 'Add Expense');

    const saveLabel = editEntry ? 'Save Changes' : (form.type === 'income' ? 'Add Income' : 'Add Expense');
    const saveBtnClass = (form.type === 'income' && !editEntry) ? 'btn-success' : (editEntry ? 'btn-primary' : 'btn-danger');

    return (
        <>
            {/* Summary Cards */}
            {isFiltered && (
                <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)', padding: '8px 14px', marginBottom: '12px', fontSize: '0.8125rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                    📊 Showing totals for filtered results ({filtered.length} entries)
                </div>
            )}
            <div className="profit-summary">
                <div className="profit-card sales">
                    <h3>
                        <FiArrowDownLeft style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        {isFiltered ? 'Filtered Income' : 'Total Income'}
                    </h3>
                    <div className="amount" style={{ color: 'var(--success-600)' }}>
                        {formatCurrency(totalIncome)}
                    </div>
                </div>
                <div className="profit-card cost">
                    <h3>
                        <FiArrowUpRight style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        {isFiltered ? 'Filtered Expenses' : 'Total Expenses'}
                    </h3>
                    <div className="amount" style={{ color: 'var(--danger-600)' }}>
                        {formatCurrency(totalExpense)}
                    </div>
                </div>
                <div className="profit-card profit">
                    <h3>{isFiltered ? 'Filtered Balance' : 'Net Balance'}</h3>
                    <div
                        className="amount"
                        style={{ color: netBalance >= 0 ? 'var(--success-600)' : 'var(--danger-600)' }}
                    >
                        {formatCurrency(netBalance)}
                    </div>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="card">
                <div className="card-header">
                    <h2>Ledger ({totalLedger} entries)</h2>
                    <div className="filters-row">
                        <div className="search-bar">
                            <FiSearch className="search-icon" />
                            <input
                                placeholder="Search entries..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                id="ledger-search"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            style={{ maxWidth: '160px' }}
                        >
                            <option value="all">All Types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                        {/* Admin: Add Income + Add Expense. Employee: Add Expense only */}
                        {(isAdmin || hasPermission('ledger')) && (
                            <>
                                {isAdmin && (
                                    <button className="btn btn-success" onClick={() => openAdd('income')} id="add-income-btn">
                                        <FiArrowDownLeft /> Add Income
                                    </button>
                                )}
                                <button className="btn btn-danger" onClick={() => openAdd('expense')} id="add-expense-btn">
                                    <FiArrowUpRight /> Add Expense
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Reference</th>
                                <th>Amount</th>
                                <th>Balance</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((entry) => (
                                <tr key={entry.id}>
                                    <td data-label="Date">
                                        {new Date(entry.date).toLocaleDateString('en-IN', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                        })}
                                    </td>
                                    <td data-label="Type">
                                        <span className={`badge ${entry.type === 'income' ? 'badge-paid' : 'badge-unpaid'}`}>
                                            {entry.type === 'income' ? '↓ Income' : '↑ Expense'}
                                        </span>
                                    </td>
                                    <td data-label="Category">{entry.category}</td>
                                    <td data-label="Description">{entry.description}</td>
                                    <td data-label="Reference" className="font-mono text-muted">{entry.reference || '—'}</td>
                                    <td
                                        data-label="Amount"
                                        className={`font-bold ${entry.type === 'income' ? 'text-success' : 'text-danger'}`}
                                    >
                                        {entry.type === 'income' ? '+' : '-'} {formatCurrency(entry.amount)}
                                    </td>
                                    <td
                                        data-label="Balance"
                                        className="font-bold"
                                        style={{
                                            color: (balanceMap[entry.id] || 0) >= 0
                                                ? 'var(--success-600)'
                                                : 'var(--danger-600)',
                                        }}
                                    >
                                        {formatCurrency(balanceMap[entry.id] || 0)}
                                    </td>
                                    <td data-label="Actions">
                                        <div className="flex gap-8">
                                            {/* Edit: admin can edit all; employee can edit own */}
                                            {canEdit(entry) && (
                                                <button
                                                    className="btn btn-secondary btn-sm btn-icon"
                                                    title="Edit"
                                                    onClick={() => openEdit(entry)}
                                                >
                                                    <FiEdit2 size={14} />
                                                </button>
                                            )}
                                            {/* Delete: admin only */}
                                            {isAdmin && (
                                                <button
                                                    className="btn btn-secondary btn-sm btn-icon"
                                                    title="Delete"
                                                    onClick={() => handleDelete(entry.id)}
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📒</div>
                                            <h3>No entries found</h3>
                                            <p>
                                                {isAdmin
                                                    ? 'Add income or expense entries to track your finances'
                                                    : 'You have not added any expense entries yet'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalLedger > PAGE_SIZE && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--border-light)', background: 'white', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalLedger)} of {totalLedger}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 8px' }}>Page {page} of {Math.ceil(totalLedger / PAGE_SIZE)}</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(Math.ceil(totalLedger / PAGE_SIZE), p + 1))} disabled={page === Math.ceil(totalLedger / PAGE_SIZE)}>Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add / Edit Entry Modal */}
            {showAdd && (
                <Modal
                    title={modalTitle}
                    onClose={closeModal}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={closeModal}>
                                Cancel
                            </button>
                            <button
                                className={`btn ${saveBtnClass}`}
                                onClick={handleSave}
                                id="save-ledger-btn"
                                disabled={!form.category || !form.amount || !form.description}
                            >
                                {saveLabel}
                            </button>
                        </>
                    }
                >
                    {/* Type selector — admin only; employees always create expense */}
                    {isAdmin && !editEntry && (
                        <div className="form-group">
                            <label>Type</label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm({ ...form, type: e.target.value, category: '' })}
                            >
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Category *</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                        >
                            <option value="">Select category</option>
                            {(form.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Description *</label>
                        <input
                            placeholder="Enter description"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Amount *</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Date</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Reference / Note</label>
                        <input
                            placeholder="e.g. Invoice #123, Bill #456"
                            value={form.reference}
                            onChange={(e) => setForm({ ...form, reference: e.target.value })}
                        />
                    </div>
                </Modal>
            )}
        </>
    );
}
