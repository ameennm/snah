import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

const ROLES = [
    { id: 'employee_orders', label: 'Order Creator' },
    { id: 'employee_tracking', label: 'Tracking Manager' },
    { id: 'crm_em', label: 'CRM Executive' },
];

export default function EmployeesPage() {
    const { user, api } = useApp();
    const [employees, setEmployees] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [form, setForm] = useState({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'employee_orders',
        roles: ['employee_orders'],
        roleLabel: 'Order Creator'
    });

    const loadEmployees = async () => {
        try {
            console.log('[Employees] Loading employees...');
            const data = await api('/users');
            console.log('[Employees] Loaded users from API:', data);
            const filtered = data.filter(u => u.role !== 'super_admin');
            setEmployees(filtered);
        } catch (error) {
            console.error('[Employees] Failed to load employees:', error);
        }
    };

    useEffect(() => {
        loadEmployees();
    }, []);

    useEffect(() => {
        if (employees.length > 0) {
            console.log('[Employees] Employee list updated:', employees);
        }
    }, [employees]);

    const handleRoleToggle = (roleId) => {
        let newRoles = [...(form.roles || [])];
        if (newRoles.includes(roleId)) {
            newRoles = newRoles.filter(r => r !== roleId);
        } else {
            newRoles.push(roleId);
        }

        // Update roleLabel based on selected roles
        const labels = ROLES.filter(r => newRoles.includes(r.id)).map(r => r.label);
        const roleLabel = labels.length > 0 ? labels.join(', ') : 'No Access';

        setForm({ ...form, roles: newRoles, roleLabel });
    };

    const openAddModal = () => {
        setForm({
            username: '',
            password: '',
            name: '',
            email: '',
            role: '',
            roles: [],
            roleLabel: ''
        });
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
            const roles = Array.isArray(form.roles) ? form.roles : [];
            const role = roles.length > 0 ? roles[0] : (form.role || '');
            const updateData = {
                username: form.username,
                name: form.name,
                email: form.email,
                role,
                roles,
                roleLabel: form.roleLabel,
                updatedBy: user.id
            };
            if (form.password) updateData.password = form.password;

            console.log('[Employees] Saving employee...', {
                isEdit: !!editingEmployee,
                id: editingEmployee?.id,
                payload: updateData
            });

            if (editingEmployee) {
                const res = await api(`/users/${editingEmployee.id}`, { method: 'PUT', body: updateData });
                console.log('[Employees] Update response:', res);
            } else {
                const res = await api('/users', { method: 'POST', body: { ...updateData, createdBy: user.id } });
                console.log('[Employees] Create response:', res);
            }
            console.log('[Employees] Save successful, reloading...');
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
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {(emp.roles || []).map(rId => {
                                            const roleObj = ROLES.find(r => r.id === rId);
                                            return (
                                                <span key={rId} className="badge" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)', marginRight: '4px' }}>
                                                    {roleObj ? roleObj.label : rId}
                                                </span>
                                            );
                                        })}
                                        {(!emp.roles || emp.roles.length === 0) && (
                                            <span className="badge badge-secondary">No Roles</span>
                                        )}
                                    </div>
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
                        <label>Roles / Access Level *</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                            {ROLES.map(r => (
                                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'normal' }}>
                                    <input
                                        type="checkbox"
                                        checked={(form.roles || []).includes(r.id)}
                                        onChange={() => handleRoleToggle(r.id)}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    {r.label}
                                </label>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
