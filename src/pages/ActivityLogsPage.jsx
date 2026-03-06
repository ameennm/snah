import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FiSearch } from 'react-icons/fi';

export default function ActivityLogsPage() {
    const { user, api } = useApp();
    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState('');

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

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const term = search.toLowerCase();
            return (
                (log.user_name || '').toLowerCase().includes(term) ||
                (log.action || '').toLowerCase().includes(term) ||
                (log.entity || '').toLowerCase().includes(term) ||
                (log.details || '').toLowerCase().includes(term)
            );
        });
    }, [logs, search]);

    return (
        <div className="card">
            <div className="card-header flex justify-between items-center" style={{ marginBottom: '16px' }}>
                <h2>Activity Logs</h2>
                <div className="search-bar" style={{ width: '300px' }}>
                    <FiSearch className="text-muted" />
                    <input
                        type="text"
                        placeholder="Search logs by user, action, or details..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full"
                    />
                </div>
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
                        {filteredLogs.map(log => (
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
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan="5">
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📄</div>
                                        <h3>No activity logs found.</h3>
                                        <p>Try adjusting your search query.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
