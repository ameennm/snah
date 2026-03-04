import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { showToast } from '../../components/crm/CrmToast';

const STATUS_LABELS = { 'hot': '🔥 Hot', 'warm': '🌡️ Warm', 'cold': '🧊 Cold', 'not-interested': '👎 Not Interested' };

function getUrgency(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    const diff = Math.floor((d - now) / 86400000);
    if (diff < 0) return { key: 'overdue', label: '🔴 Overdue', border: 'var(--accent-red)', bg: 'rgba(248,113,113,0.08)' };
    if (diff === 0) return { key: 'today', label: '🟡 Today', border: '#facc15', bg: 'rgba(250,204,21,0.08)' };
    if (diff <= 3) return { key: 'soon', label: '🟠 Soon', border: 'var(--accent-orange)', bg: 'rgba(251,146,60,0.08)' };
    return { key: 'upcoming', label: '🟢 Upcoming', border: 'var(--accent-green)', bg: 'rgba(52,211,153,0.08)' };
}

export default function CrmRemindersPage({ preFilter = null }) {
    const { crmLeads, updateCrmLead } = useApp();
    const [search, setSearch] = useState('');
    const [urgencyFilter, setUrgencyFilter] = useState(preFilter || 'all');
    const [starredOnly, setStarredOnly] = useState(false);
    const [reschedulingId, setReschedulingId] = useState(null);
    const [reschedDate, setReschedDate] = useState('');
    const [reschedTime, setReschedTime] = useState('17:00');

    const withReminders = useMemo(() =>
        crmLeads
            .filter(l => l.next_call_date && l.status !== 'not-interested')
            .map(l => ({ ...l, urgency: getUrgency(l.next_call_date) }))
            .filter(l => l.urgency)
            .sort((a, b) => new Date(a.next_call_date) - new Date(b.next_call_date)),
        [crmLeads]
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return withReminders.filter(l => {
            if (q && !l.name.toLowerCase().includes(q) && !l.whatsapp.includes(q)) return false;
            if (starredOnly && !l.is_starred) return false;
            if (urgencyFilter !== 'all' && l.urgency.key !== urgencyFilter) return false;
            return true;
        });
    }, [withReminders, search, urgencyFilter, starredOnly]);

    const markDone = (lead) => {
        updateCrmLead({ ...lead, next_call_date: '' });
        showToast('Reminder cleared ✓');
    };

    const handleReschedule = (lead) => {
        if (!reschedDate) return;
        updateCrmLead({ ...lead, next_call_date: `${reschedDate}T${reschedTime}` });
        setReschedulingId(null);
        showToast('Rescheduled ✓');
    };

    const titles = { null: 'Reminders', overdue: 'Missed Calls' };
    const pageTitle = preFilter === 'overdue' ? '📵 Missed Calls' : '🔔 Reminders';
    const pageSubtitle = preFilter === 'overdue'
        ? 'Overdue follow-ups that need immediate attention'
        : 'Upcoming and overdue follow-up calls';

    return (
        <div className="page-content crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">{pageTitle}</h1>
                    <p className="crm-page-subtitle">{pageSubtitle}</p>
                </div>
            </div>

            <input
                className="crm-search-input"
                placeholder="🔍 Search by name or WhatsApp..."
                value={search}
                onChange={e => setSearch(e.target.value)}
            />

            <div className="crm-filters-row">
                <div className="crm-filter-pills">
                    {!preFilter && [
                        { v: 'all', l: 'All' },
                        { v: 'overdue', l: '🔴 Overdue' },
                        { v: 'today', l: '🟡 Today' },
                        { v: 'soon', l: '🟠 Soon' },
                        { v: 'upcoming', l: '🟢 Upcoming' },
                    ].map(({ v, l }) => (
                        <button key={v} className={`crm-pill ${urgencyFilter === v ? 'active' : ''}`} onClick={() => setUrgencyFilter(v)}>{l}</button>
                    ))}
                    <button className={`crm-pill ${starredOnly ? 'active' : ''}`} onClick={() => setStarredOnly(s => !s)}>⭐ Starred</button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="crm-empty-state">
                    <div className="crm-empty-icon">{preFilter === 'overdue' ? '🎉' : '🔔'}</div>
                    <p>{preFilter === 'overdue' ? 'No missed calls! Great job.' : 'No reminders found.'}</p>
                </div>
            ) : (
                <div className="crm-reminders-list">
                    {filtered.map(lead => (
                        <div
                            key={lead.id}
                            className="crm-reminder-card"
                            style={{ borderLeft: `4px solid ${lead.urgency.border}`, background: lead.urgency.bg }}
                        >
                            <div className="crm-reminder-top">
                                <div className="crm-card-avatar-name">
                                    <div className="crm-avatar crm-avatar-sm">{lead.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div className="crm-card-name">{lead.name} {lead.is_starred ? '⭐' : ''}</div>
                                        <div className="crm-card-whatsapp">📱 {lead.whatsapp}</div>
                                    </div>
                                </div>
                                <div className="crm-reminder-badges">
                                    <span className="crm-urgency-badge" style={{ color: lead.urgency.border }}>{lead.urgency.label}</span>
                                    <span className={`crm-status-badge crm-status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
                                </div>
                            </div>

                            <div className="crm-reminder-time">
                                ⏰ {new Date(lead.next_call_date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}
                            </div>

                            {lead.next_action_message && (
                                <div className="crm-reminder-action">
                                    <span className="crm-reminder-action-label">💬 Say:</span>
                                    <span>{lead.next_action_message}</span>
                                </div>
                            )}

                            {lead.call_notes && (
                                <div className="crm-reminder-notes">📝 {lead.call_notes}</div>
                            )}

                            {reschedulingId === lead.id ? (
                                <div className="crm-reschedule-form">
                                    <div className="crm-form-row">
                                        <input type="date" className="crm-input crm-input-sm" value={reschedDate} onChange={e => setReschedDate(e.target.value)} />
                                        <input type="time" className="crm-input crm-input-sm" value={reschedTime} onChange={e => setReschedTime(e.target.value)} />
                                    </div>
                                    <div className="crm-form-row" style={{ marginTop: '0.5rem' }}>
                                        <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => handleReschedule(lead)}>Confirm</button>
                                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setReschedulingId(null)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="crm-reminder-actions">
                                    <button className="crm-btn crm-btn-sm crm-btn-success" onClick={() => markDone(lead)}>✅ Done</button>
                                    <button className="crm-btn crm-btn-sm crm-btn-ghost" onClick={() => { setReschedulingId(lead.id); setReschedDate(''); }}>🔄 Reschedule</button>
                                    <a className="crm-btn crm-btn-sm crm-btn-ghost" href={`tel:${lead.whatsapp}`}>📞 Call</a>
                                    <a className="crm-btn crm-btn-sm crm-btn-ghost" href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
