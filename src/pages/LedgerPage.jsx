import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiSearch, FiTrash2, FiArrowUpRight, FiArrowDownLeft } from 'react-icons/fi';

export default function LedgerPage() {
    const { ledger, hasPermission, addLedgerEntry, deleteLedgerEntry } = useApp();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({
        type: 'expense',
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        reference: '',
    });

    const filtered = ledger
        .filter((entry) => {
            const matchesSearch =
                entry.description.toLowerCase().includes(search.toLowerCase()) ||
                entry.category.toLowerCase().includes(search.toLowerCase()) ||
                (entry.reference || '').toLowerCase().includes(search.toLowerCase());
            const matchesType = typeFilter === 'all' || entry.type === typeFilter;
            return matchesSearch && matchesType;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIncome = ledger
        .filter((e) => e.type === 'income')
        .reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = ledger
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const openAdd = (type = 'expense') => {
        setForm({
            type,
            category: '',
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            reference: '',
        });
        setShowAdd(true);
    };

    const handleSave = async () => {
        if (!form.category || !form.amount || !form.description) return;
        await addLedgerEntry({
            ...form,
            amount: Number(form.amount),
        });
        setShowAdd(false);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this entry?')) {
            await deleteLedgerEntry(id);
        }
    };

    const formatCurrency = (val) =>
        '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const expenseCategories = [
        'Rent', 'Salary', 'Utilities', 'Shipping', 'Packaging',
        'Marketing', 'Maintenance', 'Office Supplies', 'Travel', 'Other',
    ];

    const incomeCategories = [
        'Sales', 'Refund Received', 'Interest', 'Commission', 'Other Income',
    ];

    // Running balance
    const sortedForBalance = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const balanceMap = {};
    sortedForBalance.forEach((entry) => {
        if (entry.type === 'income') {
            runningBalance += entry.amount;
        } else {
            runningBalance -= entry.amount;
        }
        balanceMap[entry.id] = runningBalance;
    });

    return (
        <>
            {/* Summary Cards */}
            <div className="profit-summary">
                <div className="profit-card sales">
                    <h3>
                        <FiArrowDownLeft style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Total Income
                    </h3>
                    <div className="amount" style={{ color: 'var(--success-600)' }}>
                        {formatCurrency(totalIncome)}
                    </div>
                </div>
                <div className="profit-card cost">
                    <h3>
                        <FiArrowUpRight style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        Total Expenses
                    </h3>
                    <div className="amount" style={{ color: 'var(--danger-600)' }}>
                        {formatCurrency(totalExpense)}
                    </div>
                </div>
                <div className="profit-card profit">
                    <h3>Net Balance</h3>
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
                    <h2>Ledger ({filtered.length} entries)</h2>
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
                        {hasPermission('dashboard') && (
                            <>
                                <button className="btn btn-success" onClick={() => openAdd('income')} id="add-income-btn">
                                    <FiArrowDownLeft /> Add Income
                                </button>
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
                                {hasPermission('dashboard') && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((entry) => (
                                <tr key={entry.id}>
                                    <td>
                                        {new Date(entry.date).toLocaleDateString('en-IN', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </td>
                                    <td>
                                        <span
                                            className={`badge ${entry.type === 'income' ? 'badge-paid' : 'badge-unpaid'}`}
                                        >
                                            {entry.type === 'income' ? '↓ Income' : '↑ Expense'}
                                        </span>
                                    </td>
                                    <td>{entry.category}</td>
                                    <td>{entry.description}</td>
                                    <td className="font-mono text-muted">{entry.reference || '—'}</td>
                                    <td
                                        className={`font-bold ${entry.type === 'income' ? 'text-success' : 'text-danger'
                                            }`}
                                    >
                                        {entry.type === 'income' ? '+' : '-'} {formatCurrency(entry.amount)}
                                    </td>
                                    <td
                                        className="font-bold"
                                        style={{
                                            color:
                                                (balanceMap[entry.id] || 0) >= 0
                                                    ? 'var(--success-600)'
                                                    : 'var(--danger-600)',
                                        }}
                                    >
                                        {formatCurrency(balanceMap[entry.id] || 0)}
                                    </td>
                                    {hasPermission('dashboard') && (
                                        <td>
                                            <button
                                                className="btn btn-secondary btn-sm btn-icon"
                                                title="Delete"
                                                onClick={() => handleDelete(entry.id)}
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={hasPermission('dashboard') ? 8 : 7}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">📒</div>
                                            <h3>No entries found</h3>
                                            <p>Add income or expense entries to track your finances</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Entry Modal */}
            {showAdd && (
                <Modal
                    title={form.type === 'income' ? 'Add Income' : 'Add Expense'}
                    onClose={() => setShowAdd(false)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                                Cancel
                            </button>
                            <button
                                className={`btn ${form.type === 'income' ? 'btn-success' : 'btn-danger'}`}
                                onClick={handleSave}
                                id="save-ledger-btn"
                            >
                                {form.type === 'income' ? 'Add Income' : 'Add Expense'}
                            </button>
                        </>
                    }
                >
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

                    <div className="form-group">
                        <label>Category *</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                        >
                            <option value="">Select category</option>
                            {(form.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
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
