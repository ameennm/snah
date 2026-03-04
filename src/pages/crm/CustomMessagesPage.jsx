import { useState, useMemo, useEffect } from 'react';
import { showToast } from '../../components/crm/CrmToast';

const CATEGORIES = [
    { key: 'greeting', label: '👋 Greeting', color: '#34d399' },
    { key: 'intro', label: '🎯 Introduction', color: '#60a5fa' },
    { key: 'video', label: '🎥 Video', color: '#a78bfa' },
    { key: 'product', label: '🛍️ Product Details', color: '#fb923c' },
    { key: 'reviews', label: '⭐ Customer Reviews', color: '#facc15' },
    { key: 'offer', label: '🏷️ Offer', color: '#f87171' },
    { key: 'payment', label: '💳 Payment & Delivery', color: '#22d3ee' },
];

import { API_BASE } from '../../context/AppContext';
async function api(endpoint, opts = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
}

export default function CustomMessagesPage() {
    const [templates, setTemplates] = useState([]);
    const [activeCategory, setActiveCategory] = useState('greeting');
    const [editing, setEditing] = useState(null); // null | { id?, category, title, message }
    const [deletingId, setDeletingId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/crm/messages').then(data => { setTemplates(data); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const inCategory = useMemo(() => templates.filter(t => t.category === activeCategory), [templates, activeCategory]);

    const openNew = () => setEditing({ category: activeCategory, title: '', message: '' });
    const openEdit = (t) => setEditing({ ...t });

    const handleSave = async () => {
        if (!editing.title.trim() || !editing.message.trim()) return;
        try {
            if (editing.id) {
                const updated = await api(`/crm/messages/${editing.id}`, { method: 'PUT', body: editing });
                setTemplates(ts => ts.map(t => t.id === editing.id ? { ...t, ...updated } : t));
                showToast('Message saved!');
            } else {
                const created = await api('/crm/messages', { method: 'POST', body: editing });
                setTemplates(ts => [...ts, created]);
                showToast('Message created!');
            }
            setEditing(null);
        } catch { showToast('Failed to save', 'error'); }
    };

    const handleDelete = async (id) => {
        try {
            await api(`/crm/messages/${id}`, { method: 'DELETE' });
            setTemplates(ts => ts.filter(t => t.id !== id));
            setDeletingId(null);
            showToast('Deleted', 'error');
        } catch { showToast('Failed to delete', 'error'); }
    };

    const cat = CATEGORIES.find(c => c.key === activeCategory);

    return (
        <div className="page-content crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">💬 Custom Messages</h1>
                    <p className="crm-page-subtitle">Store reusable message templates for each stage of the sales conversation</p>
                </div>
                <button className="crm-btn crm-btn-primary" onClick={openNew}>+ New Message</button>
            </div>

            {/* Category tabs */}
            <div className="cmsg-tabs">
                {CATEGORIES.map(c => (
                    <button
                        key={c.key}
                        className={`cmsg-tab ${activeCategory === c.key ? 'active' : ''}`}
                        style={activeCategory === c.key ? { borderColor: c.color, color: c.color } : {}}
                        onClick={() => setActiveCategory(c.key)}
                    >
                        {c.label}
                        {templates.filter(t => t.category === c.key).length > 0 && (
                            <span className="cmsg-tab-count">{templates.filter(t => t.category === c.key).length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Template list */}
            {loading ? (
                <div className="crm-empty-state"><div className="crm-empty-icon">⏳</div><p>Loading...</p></div>
            ) : inCategory.length === 0 ? (
                <div className="crm-empty-state">
                    <div className="crm-empty-icon">{cat?.label.split(' ')[0]}</div>
                    <p>No {cat?.label} messages yet.</p>
                    <button className="crm-btn crm-btn-primary" onClick={openNew}>+ Add First Message</button>
                </div>
            ) : (
                <div className="cmsg-list">
                    {inCategory.map(t => (
                        <div key={t.id} className="cmsg-card" style={{ borderLeftColor: cat?.color }}>
                            <div className="cmsg-card-header">
                                <div className="cmsg-title">{t.title}</div>
                                <div className="cmsg-actions">
                                    <button className="crm-icon-btn" title="Edit" onClick={() => openEdit(t)}>✏️</button>
                                    <button className="crm-icon-btn crm-icon-btn-danger" title="Delete" onClick={() => setDeletingId(t.id)}>🗑️</button>
                                </div>
                            </div>
                            <div className="cmsg-body">{t.message}</div>
                            <div className="cmsg-copy-row">
                                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => { navigator.clipboard.writeText(t.message); showToast('Copied!'); }}>
                                    📋 Copy
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit modal */}
            {editing && (
                <div className="crm-modal-overlay" onClick={() => setEditing(null)}>
                    <div className="crm-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <h2>{editing.id ? '✏️ Edit Message' : '+ New Message'}</h2>
                            <button className="crm-modal-close" onClick={() => setEditing(null)}>✕</button>
                        </div>
                        <div className="crm-modal-body" style={{ gap: '1rem' }}>
                            <div className="crm-form-group">
                                <label>Category</label>
                                <select className="crm-input" value={editing.category} onChange={e => setEditing(ed => ({ ...ed, category: e.target.value }))}>
                                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="crm-form-group">
                                <label>Title (short name for this message)</label>
                                <input className="crm-input" placeholder="e.g. First Contact Greeting" value={editing.title} onChange={e => setEditing(ed => ({ ...ed, title: e.target.value }))} />
                            </div>
                            <div className="crm-form-group">
                                <label>Message Text</label>
                                <textarea className="crm-input crm-textarea" rows={6} placeholder="Type the full message here..." value={editing.message} onChange={e => setEditing(ed => ({ ...ed, message: e.target.value }))} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{editing.message.length} characters</span>
                            </div>
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn crm-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                            <button className="crm-btn crm-btn-primary" onClick={handleSave}>
                                {editing.id ? 'Save Changes' : 'Create Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm delete */}
            {deletingId && (
                <div className="crm-modal-overlay" onClick={() => setDeletingId(null)}>
                    <div className="crm-confirm-dialog" onClick={e => e.stopPropagation()}>
                        <div className="crm-confirm-icon">🗑️</div>
                        <p className="crm-confirm-message">Delete this message template? This cannot be undone.</p>
                        <div className="crm-confirm-actions">
                            <button className="crm-btn crm-btn-ghost" onClick={() => setDeletingId(null)}>Cancel</button>
                            <button className="crm-btn crm-btn-danger" onClick={() => handleDelete(deletingId)}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
