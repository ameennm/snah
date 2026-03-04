import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

const DATE_FILTERS = ['all', 'today', 'week', 'month', 'custom'];

function inRange(dateStr, filter, from, to) {
    if (filter === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    if (filter === 'today') return d === now;
    if (filter === 'week') {
        const start = new Date(); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 6);
        return d >= start.getTime() && d <= end.getTime();
    }
    if (filter === 'month') {
        const n = new Date();
        return new Date(dateStr).getMonth() === n.getMonth() && new Date(dateStr).getFullYear() === n.getFullYear();
    }
    if (filter === 'custom' && from && to) {
        return d >= new Date(from).setHours(0, 0, 0, 0) && d <= new Date(to).setHours(0, 0, 0, 0);
    }
    return true;
}

function getUrgencyLabel(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    const diff = Math.floor((d - now) / 86400000);
    if (diff < 0) return { label: 'Overdue', color: 'var(--accent-red)', days: Math.abs(diff) };
    if (diff === 0) return { label: 'Today', color: 'var(--accent-yellow, #facc15)', days: 0 };
    if (diff <= 3) return { label: `In ${diff}d`, color: 'var(--accent-orange)', days: diff };
    return null;
}

export default function CrmDashboardPage() {
    const { crmLeads, products } = useApp();
    const [dateFilter, setDateFilter] = useState('all');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const filtered = useMemo(() =>
        crmLeads.filter(l => inRange(l.created_at, dateFilter, from, to)),
        [crmLeads, dateFilter, from, to]
    );

    const activeLeads = filtered.filter(l => l.status !== 'not-interested');

    const totalRevenue = filtered
        .filter(l => l.payment_status === 'paid')
        .reduce((s, l) => s + (l.paid_amount || 0), 0);

    const pipeline = filtered
        .filter(l => l.status === 'hot' || l.status === 'warm')
        .reduce((s, l) => s + (l.amount || 0), 0);

    const hotLeads = filtered.filter(l => l.status === 'hot').length;

    const pendingPaymentLeads = crmLeads
        .filter(l => l.payment_status === 'pending' && l.status !== 'not-interested' && l.amount > 0)
        .map(l => ({ ...l, pending: Math.max(0, (l.amount || 0) - (l.paid_amount || 0)) }))
        .filter(l => l.pending > 0)
        .sort((a, b) => b.pending - a.pending);

    // Reminder counts (always from all leads, not date-filtered)
    const now = new Date().setHours(0, 0, 0, 0);
    const overdueCount = crmLeads.filter(l => l.next_call_date && new Date(l.next_call_date).setHours(0, 0, 0, 0) < now && l.status !== 'not-interested').length;
    const todayCount = crmLeads.filter(l => l.next_call_date && new Date(l.next_call_date).setHours(0, 0, 0, 0) === now && l.status !== 'not-interested').length;
    const upcomingCount = crmLeads.filter(l => l.next_call_date && new Date(l.next_call_date).setHours(0, 0, 0, 0) > now && l.status !== 'not-interested').length;

    // Product interest breakdown
    const productCounts = useMemo(() => {
        const counts = {};
        crmLeads.forEach(l => {
            (l.lead_products || []).forEach(lp => {
                const pid = lp.id;
                counts[pid] = (counts[pid] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .map(([pid, count]) => ({ name: products.find(p => p.id === parseInt(pid) || p.id === pid)?.name || `Product #${pid}`, count }))
            .sort((a, b) => b.count - a.count);
    }, [crmLeads, products]);

    return (
        <div className="page-content crm-page">
            <div className="crm-page-header">
                <h1 className="crm-page-title">📊 CRM Dashboard</h1>
                <p className="crm-page-subtitle">Sales pipeline overview</p>
            </div>

            {/* Date filter */}
            <div className="crm-filter-pills" style={{ marginBottom: '1.25rem' }}>
                {DATE_FILTERS.map(f => (
                    <button key={f} className={`crm-pill ${dateFilter === f ? 'active' : ''}`} onClick={() => setDateFilter(f)}>
                        {f === 'all' ? 'All Time' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>
            {dateFilter === 'custom' && (
                <div className="crm-form-row" style={{ marginBottom: '1rem', maxWidth: 400 }}>
                    <div className="crm-form-group">
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>From</label>
                        <input type="date" className="crm-input" value={from} onChange={e => setFrom(e.target.value)} />
                    </div>
                    <div className="crm-form-group">
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>To</label>
                        <input type="date" className="crm-input" value={to} onChange={e => setTo(e.target.value)} />
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="crm-stats-grid">
                <div className="crm-stat-card crm-stat-green">
                    <div className="crm-stat-icon">💰</div>
                    <div className="crm-stat-value">₹{totalRevenue.toLocaleString('en-IN')}</div>
                    <div className="crm-stat-label">Revenue Closed</div>
                </div>
                <div className="crm-stat-card crm-stat-purple">
                    <div className="crm-stat-icon">📈</div>
                    <div className="crm-stat-value">₹{pipeline.toLocaleString('en-IN')}</div>
                    <div className="crm-stat-label">In Pipeline</div>
                </div>
                <div className="crm-stat-card crm-stat-red">
                    <div className="crm-stat-icon">🔥</div>
                    <div className="crm-stat-value">{hotLeads}</div>
                    <div className="crm-stat-label">Hot Leads</div>
                </div>
                <div className="crm-stat-card crm-stat-blue">
                    <div className="crm-stat-icon">👥</div>
                    <div className="crm-stat-value">{activeLeads.length}</div>
                    <div className="crm-stat-label">Active Leads</div>
                </div>
            </div>

            {/* Follow-up summary */}
            <div className="crm-followup-bar">
                <div className="crm-followup-item crm-fu-red">
                    <span className="crm-fu-count">{overdueCount}</span>
                    <span className="crm-fu-label">🔴 Overdue</span>
                </div>
                <div className="crm-followup-item crm-fu-yellow">
                    <span className="crm-fu-count">{todayCount}</span>
                    <span className="crm-fu-label">🟡 Today</span>
                </div>
                <div className="crm-followup-item crm-fu-green">
                    <span className="crm-fu-count">{upcomingCount}</span>
                    <span className="crm-fu-label">🟢 Upcoming</span>
                </div>
            </div>

            <div className="crm-dash-bottom">
                {/* Needs attention */}
                <div className="crm-dash-card">
                    <h3 className="crm-dash-card-title">⚠️ Needs Attention</h3>
                    <p className="crm-dash-card-subtitle">Pending payments, largest first</p>
                    {pendingPaymentLeads.length === 0 ? (
                        <div className="crm-empty-small">✅ All payments settled</div>
                    ) : (
                        <div className="crm-attention-list">
                            {pendingPaymentLeads.slice(0, 8).map(l => {
                                const urgency = getUrgencyLabel(l.next_call_date);
                                return (
                                    <div key={l.id} className="crm-attention-item">
                                        <div className="crm-avatar crm-avatar-sm">{l.name.charAt(0).toUpperCase()}</div>
                                        <div className="crm-attention-info">
                                            <span className="crm-attention-name">{l.name}</span>
                                            {l.location && <span className="crm-attention-loc">{l.location}</span>}
                                        </div>
                                        <div className="crm-attention-right">
                                            <span className="crm-attention-amount">₹{l.pending.toLocaleString('en-IN')}</span>
                                            {urgency && <span className="crm-attention-urgency" style={{ color: urgency.color }}>{urgency.label}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Product interest */}
                {productCounts.length > 0 && (
                    <div className="crm-dash-card">
                        <h3 className="crm-dash-card-title">🛍️ Product Interest</h3>
                        <p className="crm-dash-card-subtitle">Which products are most in demand</p>
                        <div className="crm-product-interest-list">
                            {productCounts.map(({ name, count }) => {
                                const max = productCounts[0].count;
                                return (
                                    <div key={name} className="crm-pi-row">
                                        <span className="crm-pi-name">{name}</span>
                                        <div className="crm-pi-bar-wrap">
                                            <div className="crm-pi-bar" style={{ width: `${(count / max) * 100}%` }} />
                                        </div>
                                        <span className="crm-pi-count">{count} lead{count !== 1 ? 's' : ''}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
