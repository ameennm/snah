import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

const ROLES = [
    { id: 'employee_orders', label: 'Order Creator' },
    { id: 'employee_tracking', label: 'Tracking Manager' },
    { id: 'crm_employee', label: 'CRM Executive' },
];

export default function EmployeesPage() {
    const { user, api } = useApp();
    const [employees, setEmployees] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', name: '', email: '', role: 'employee_orders', roleLabel: 'Order Creator' });

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            const data = await api('/users');
            setEmployees(data.filter(u => u.role !== 'super_admin'));
        } catch (error) {
            console.error('Failed to load employees:', error);
        }
    };

    const handleRoleChange = (e) => {
        const role = e.target.value;
        const roleLabel = ROLES.find(r => r.id === role)?.label || '';
        setForm({ ...form, role, roleLabel });
    };

    const openAddModal = () => {
        setForm({ username: '', password: '', name: '', email: '', role: 'employee_orders', roleLabel: 'Order Creator' });
        setEditingEmployee(null);
        setShowModal(true);
    };

    const openEditModal = (emp) => {
        setForm({ ...emp, password: '' }); // Don't show existing password
        setEditingEmployee(emp);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.username || !form.name) return;
        if (!editingEmployee && !form.password) return alert('Password is required for new employees');

        try {
            if (editingEmployee) {
                const updateData = { ...form };
                if (!updateData.password) delete updateData.password;
                updateData.updatedBy = user.id;
                await api(`/users/${editingEmployee.id}`, { method: 'PUT', body: updateData });
            } else {
                await api('/users', { method: 'POST', body: { ...form, createdBy: user.id } });
            }
            setShowModal(false);
            loadEmployees();
        } catch (err) {
            alert(err.message || 'Error saving employee');
        }
    };

    const toggleStatus = async (emp) => {
        if (!window.confirm(`Are you sure you want to ${emp.status === 'active' ? 'suspend' : 'activate'} this employee?`)) return;
        try {
            const newStatus = emp.status === 'active' ? 'suspended' : 'active';
            await api(`/users/${emp.id}`, { method: 'PUT', body: { status: newStatus, updatedBy: user.id } });
            loadEmployees();
        } catch (err) {
            alert(err.message || 'Error updating status');
        }
    };

    if (user?.role !== 'super_admin') return <div className="p-4">Access Denied</div>;

    return (
        <div className="card">
            <div className="card-header flex justify-between items-center" style={{ marginBottom: '16px' }}>
                <h2>Manage Employees</h2>
                <button className="btn btn-primary" onClick={openAddModal}>
                    <FiPlus /> Add Employee
                </button>
            </div>

            <div className="alert alert-info" style={{ marginBottom: '16px', background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <strong>Tip:</strong> You can assign different roles to employees to control their access to modules (e.g. CRM, Orders, Tracking).
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Status (Activity)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id} style={{ opacity: emp.status === 'suspended' ? 0.6 : 1 }}>
                                <td className="font-bold">{emp.name}</td>
                                <td className="font-mono">{emp.username}</td>
                                <td>
                                    <span className="badge" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}>
                                        {emp.role_label}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`status-indicator ${emp.status === 'active' ? 'status-active' : 'status-inactive'}`}
                                            style={{
                                                display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                                                background: emp.status === 'active' ? 'var(--success-500)' : 'var(--danger-500)'
                                            }}></span>
                                        {emp.status === 'active' ? 'Active' : 'Suspended'}
                                        {/* TODO: Add login status later if needed */}
                                    </div>
                                </td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEditModal(emp)}>
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button className="btn btn-secondary btn-sm btn-icon" title={emp.status === 'active' ? 'Suspend' : 'Activate'} onClick={() => toggleStatus(emp)}>
                                            {emp.status === 'active' ? <FiToggleLeft size={16} /> : <FiToggleRight size={16} className="text-success" />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <Modal
                    title={editingEmployee ? "Edit Employee" : "Add Employee"}
                    onClose={() => setShowModal(false)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave}>Save</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label>Name *</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Username (Login ID) *</label>
                        <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>{editingEmployee ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                        <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Role / Access Level *</label>
                        <select value={form.role} onChange={handleRoleChange}>
                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                    </div>
                </Modal>
            )}
        </div>
    );
}
