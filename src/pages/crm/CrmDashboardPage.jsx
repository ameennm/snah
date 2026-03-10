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

    // Force employee to see only their own stats
    const isAdmin = user?.role === 'super_admin';
    const effectiveEmpId = isAdmin ? selectedEmpId : user?.id;

    const stats = useMemo(() => {
        const relevantLeads = effectiveEmpId
            ? crmLeads.filter(l => l.created_by === effectiveEmpId || l.closer_id === effectiveEmpId || l.assigned_to === effectiveEmpId)
            : crmLeads;

        // Breakdown counts
        const breakdown = {
            hot: relevantLeads.filter(l => l.status === 'hot').length,
            warm: relevantLeads.filter(l => l.status === 'warm').length,
            cold: relevantLeads.filter(l => l.status === 'cold').length,
            notInterested: relevantLeads.filter(l => l.status === 'not-interested').length,
            paid: relevantLeads.filter(l => l.payment_status === 'paid').length,
            pending: relevantLeads.filter(l => l.payment_status === 'pending').length,
        };

        const empStats = employees.filter(e => e.role !== 'super_admin').map(emp => {
            const leadsEntered = crmLeads.filter(l => l.created_by === emp.id).length;
            const leadsClosed = crmLeads.filter(l => l.closer_id === emp.id && l.converted).length;

            return {
                ...emp,
                leadsEntered,
                leadsClosed,
                conversionRate: leadsEntered > 0 ? ((leadsClosed / leadsEntered) * 100).toFixed(1) : 0
            };
        });

        return {
            totalLeads: relevantLeads.length,
            totalClosed: relevantLeads.filter(l => l.converted).length,
            breakdown,
            employeeStats: empStats,
            selectedName: effectiveEmpId ? employees.find(e => e.id === effectiveEmpId)?.name : 'Overall Business'
        };
    }, [crmLeads, orders, employees, effectiveEmpId]);

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
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b' }}>{stats.breakdown.hot}</div>
                </div>
                <div className="stat-mini-card" style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, textTransform: 'uppercase' }}>🌡️ Warm</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400e' }}>{stats.breakdown.warm}</div>
                </div>
                <div className="stat-mini-card" style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>🧊 Cold</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e40af' }}>{stats.breakdown.cold}</div>
                </div>
                <div className="stat-mini-card" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600, textTransform: 'uppercase' }}>👎 Not Int.</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#374151' }}>{stats.breakdown.notInterested}</div>
                </div>
                <div className="stat-mini-card" style={{ background: '#ecfdf5', border: '1px solid #d1fae5', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600, textTransform: 'uppercase' }}>✅ Paid</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065f46' }}>{stats.breakdown.paid}</div>
                </div>
                <div className="stat-mini-card" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '12px', borderRadius: ' var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 600, textTransform: 'uppercase' }}>⏳ Pending</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#9a3412' }}>{stats.breakdown.pending}</div>
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
                                {stats.employeeStats.map(emp => (
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
        </div>
    );
}
