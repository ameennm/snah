import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { FiUsers, FiTrendingUp, FiTarget, FiCheckCircle } from 'react-icons/fi';

export default function CrmDashboardPage() {
    const { crmLeads, orders, user, api } = useApp();
    const [employees, setEmployees] = useState([]);
    const [selectedEmpId, setSelectedEmpId] = useState(null);

    useEffect(() => {
        api('/users').then(setEmployees).catch(console.error);
    }, [api]);

    const isAdmin = user?.role === 'super_admin';
    const effectiveEmpId = isAdmin ? selectedEmpId : user?.id;

    const [stats, setStats] = useState({
        totalLeads: 0,
        totalClosed: 0,
        breakdown: { hot: 0, warm: 0, cold: 0, notInterested: 0, paid: 0, pending: 0 },
        employeeStats: [],
        selectedName: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        let url = '/crm/dashboard-stats';
        if (effectiveEmpId) url += `?empFilter=${effectiveEmpId}`;
        
        api(url)
            .then(data => {
                const name = effectiveEmpId 
                    ? employees.find(e => e.id === effectiveEmpId)?.name || 'Employee' 
                    : 'Overall Business';
                setStats({ ...data, selectedName: name });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [api, effectiveEmpId, employees]);

    const selectedEmployee = effectiveEmpId ? employees.find(e => e.id === effectiveEmpId) : null;

    return (
        <div className="page-content crm-dashboard">
            <div className="crm-page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="crm-page-title">📈 CRM Overview: {stats.selectedName}</h1>
                    <p className="crm-page-subtitle">
                        {effectiveEmpId ? `Showing performance for ${stats.selectedName}` : 'Showing combined performance for all employees'}
                    </p>
                </div>
                {isAdmin && effectiveEmpId && (
                    <button className="crm-btn crm-btn-ghost" onClick={() => setSelectedEmpId(null)}>
                        🏠 Show Overall Picture
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading Stats...</div>
            ) : (
                <>
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon blue"><FiTarget /></div>
                        <div className="stat-info">
                            <div className="stat-label">Total Leads</div>
                            <div className="stat-value">{stats.totalLeads}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon green"><FiCheckCircle /></div>
                        <div className="stat-info">
                            <div className="stat-label">Leads Closed</div>
                            <div className="stat-value">{stats.totalClosed}</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon yellow"><FiTrendingUp /></div>
                        <div className="stat-info">
                            <div className="stat-label">Conversion Rate</div>
                            <div className="stat-value">
                                {stats.totalLeads > 0 ? ((stats.totalClosed / stats.totalLeads) * 100).toFixed(1) : 0}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Breakdown Grid */}
                <div className="crm-dashboard-breakdown" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '1.5rem' }}>
                    <div className="stat-mini-card" style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>🔥 Hot</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b' }}>{stats.breakdown?.hot || 0}</div>
                    </div>
                    <div className="stat-mini-card" style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, textTransform: 'uppercase' }}>🌡️ Warm</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400e' }}>{stats.breakdown?.warm || 0}</div>
                    </div>
                    <div className="stat-mini-card" style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>🧊 Cold</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e40af' }}>{stats.breakdown?.cold || 0}</div>
                    </div>
                    <div className="stat-mini-card" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600, textTransform: 'uppercase' }}>👎 Not Int.</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#374151' }}>{stats.breakdown?.notInterested || 0}</div>
                    </div>
                    <div className="stat-mini-card" style={{ background: '#ecfdf5', border: '1px solid #d1fae5', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600, textTransform: 'uppercase' }}>✅ Paid</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065f46' }}>{stats.breakdown?.paid || 0}</div>
                    </div>
                    <div className="stat-mini-card" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 600, textTransform: 'uppercase' }}>⏳ Pending</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#9a3412' }}>{stats.breakdown?.pending || 0}</div>
                    </div>
                </div>

                {isAdmin && (
                    <div className="card" style={{ marginTop: '24px' }}>
                        <div className="card-header">
                            <h2>Employee Performance Benchmarks</h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>Click an employee name to see their personal overview</p>
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Leads Entered</th>
                                        <th>Leads Closed</th>
                                        <th>Conversion Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(stats.employeeStats || []).map(emp => (
                                        <tr
                                            key={emp.id}
                                            onClick={() => setSelectedEmpId(emp.id)}
                                            style={{ cursor: 'pointer', background: effectiveEmpId === emp.id ? 'var(--primary-50)' : 'inherit' }}
                                            className="crm-table-row"
                                        >
                                            <td className="font-bold" style={{ color: 'var(--primary-600)' }}>{emp.name}</td>
                                            <td>{emp.leadsEntered}</td>
                                            <td>{emp.leadsClosed}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, height: '8px', background: 'var(--gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${emp.conversionRate}%`, height: '100%', background: 'var(--success-500)' }}></div>
                                                    </div>
                                                    <span>{emp.conversionRate}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
            )}
        </div>
    );
}
