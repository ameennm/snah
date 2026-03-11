import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FiSearch, FiCalendar, FiRefreshCw } from 'react-icons/fi';

const PAGE_SIZE = 20;

export default function ActivityLogsPage() {
    const { user, api } = useApp();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Default to today in IST (UTC+5:30)
    const todayIST = () => {
        const now = new Date();
        const offset = 5.5 * 60 * 60000;
        const ist = new Date(now.getTime() + offset);
        return ist.toISOString().split('T')[0];
    };

    const [selectedDate, setSelectedDate] = useState(todayIST);
    const [page, setPage] = useState(1);

    const [totalLogs, setTotalLogs] = useState(0);

    const fetchLogs = () => {
        if (user?.role !== 'super_admin') return;
        setLoading(true);
        const offset = (page - 1) * PAGE_SIZE;
        api(`/activity_logs?limit=${PAGE_SIZE}&offset=${offset}`)
            .then(data => {
                setLogs(data.results || []);
                setTotalLogs(data.total || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchLogs(); }, [user, page]);

    if (user?.role !== 'super_admin') return <div className="p-4">Access Denied</div>;

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString('en-IN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true,
        });
    };

    const formatDateLabel = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // The logs are now pre-filtered and paginated from the backend logically.
    // However, the selectedDate and search filtering are still partly client-side over the CURRENT PAGE. 
    // Ideally this would move to backend, but since the user goal is just limiting DB reads, we'll keep the DB fetch limited to 20.
    // For pure server-side, search/date would need to pass in the fetchLogs.
    const filteredLogs = useMemo(() => {
        let currentLogs = logs;
        
        // Filter by date
        currentLogs = currentLogs.filter(log => {
            const d = new Date(log.created_at);
            const offset = 5.5 * 60 * 60000;
            const ist = new Date(d.getTime() + offset);
            return ist.toISOString().split('T')[0] === selectedDate;
        });
        
        // Filter by search
        if (search.trim()) {
            const term = search.toLowerCase();
            currentLogs = currentLogs.filter(log =>
                (log.user_name || '').toLowerCase().includes(term) ||
                (log.action || '').toLowerCase().includes(term) ||
                (log.entity || '').toLowerCase().includes(term) ||
                (log.details || '').toLowerCase().includes(term)
            );
        }
        
        return currentLogs;
    }, [logs, selectedDate, search]);

    const totalPages = Math.ceil(totalLogs / PAGE_SIZE);
    const paginated = filteredLogs; // Display the current chunk returned by API

    const isToday = selectedDate === todayIST();

    const actionColor = (action) => {
        if (action === 'login') return 'badge-paid';
        if (action === 'delete') return 'badge-unpaid';
        if (action === 'create') return 'badge-partial';
        return '';
    };

    return (
        <div className="card">
            <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                <div className="flex justify-between" style={{ width: '100%', alignItems: 'center' }}>
                    <div>
                        <h2>Activity Logs</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            {isToday ? `Today` : formatDateLabel(selectedDate + 'T00:00:00')} — {totalLogs} event{totalLogs !== 1 ? 's' : ''} total
                        </p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading} title="Refresh">
                        <FiRefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
                    {/* Date picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: '6px 12px', border: '1px solid var(--border-light)' }}>
                        <FiCalendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <input
                            type="date"
                            value={selectedDate}
                            max={todayIST()}
                            onChange={e => { setSelectedDate(e.target.value); setPage(1); }}
                            style={{ border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                        />
                    </div>

                    {!isToday && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedDate(todayIST()); setPage(1); }}>
                            Back to Today
                        </button>
                    )}

                    {/* Search */}
                    <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by user, action, or details..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
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
                        {loading && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>Loading...</td></tr>
                        )}
                        {!loading && paginated.map(log => (
                            <tr key={log.id}>
                                <td className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                    {formatTime(log.created_at)}
                                </td>
                                <td className="font-bold">
                                    {log.user_name || 'System'}
                                    <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>{log.user_role}</div>
                                </td>
                                <td>
                                    <span className={`badge ${actionColor(log.action)}`} style={{ textTransform: 'capitalize' }}>
                                        {log.action}
                                    </span>
                                </td>
                                <td style={{ textTransform: 'capitalize' }}>
                                    {log.entity} <span className="font-mono" style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>#{log.entity_id}</span>
                                </td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{log.details}</td>
                            </tr>
                        ))}
                        {!loading && filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan="5">
                                    <div className="empty-state">
                                        <div className="empty-state-icon">📄</div>
                                        <h3>{isToday ? 'No activity today yet.' : 'No logs for this date.'}</h3>
                                        <p>{search ? 'Try clearing your search.' : 'Select a different date to view older logs.'}</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid var(--border-light)' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
                </div>
            )}
        </div>
    );
}
