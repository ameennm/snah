import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function ActivityLogsPage() {
    const { user, api } = useApp();
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        if (user?.role === 'super_admin') {
            api('/activity_logs').then(setLogs).catch(console.error);
        }
    }, [user, api]);

    if (user?.role !== 'super_admin') return <div className="p-4">Access Denied</div>;

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2>Activity Logs</h2>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>Entity</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td className="font-mono text-secondary" style={{ fontSize: '0.85rem' }}>{formatDate(log.created_at)}</td>
                                <td className="font-bold">
                                    {log.user_name || 'System / Unknown'}
                                    <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>{log.user_role}</div>
                                </td>
                                <td>
                                    <span className={`badge ${log.action === 'login' ? 'badge-paid' : log.action === 'delete' ? 'badge-unpaid' : 'badge-partial'}`} style={{ textTransform: 'capitalize' }}>
                                        {log.action}
                                    </span>
                                </td>
                                <td style={{ textTransform: 'capitalize' }}>{log.entity} <span className="font-mono text-secondary">#{log.entity_id}</span></td>
                                <td>{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
