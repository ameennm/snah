import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import CrmLeadModal from '../../components/crm/CrmLeadModal';
import CrmLeadDetailModal from '../../components/crm/CrmLeadDetailModal';
import CrmConfirmDialog from '../../components/crm/CrmConfirmDialog';
import { showToast } from '../../components/crm/CrmToast';

const STATUS_LABELS = { 'hot': '🔥 Hot', 'warm': '🌡️ Warm', 'cold': '🧊 Cold', 'not-interested': '👎 Not Interested' };

export default function CrmLeadsPage() {
    const { crmLeads, crmLeadsTotal, products, addCrmLead, updateCrmLead, deleteCrmLead, addOrder, addCustomerAsync, customers, user, api, searchCrmLeads } = useApp();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [payFilter, setPayFilter] = useState('all');
    const [starredOnly, setStarredOnly] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [showModal, setShowModal] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [viewingLead, setViewingLead] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [passingLead, setPassingLead] = useState(null);
    const [recipientId, setRecipientId] = useState('');
    const [employees, setEmployees] = useState([]); // Filtered for passing
    const [allUsers, setAllUsers] = useState([]); // For lookups
    const [tab, setTab] = useState('my-leads'); // 'my-leads', 'passing-in', 'passing-out'
    const [empFilter, setEmpFilter] = useState('all');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    useEffect(() => {
        api('/users').then(data => {
            setAllUsers(data);
            if (user?.role === 'super_admin') {
                setEmployees(data.filter(u => u.status === 'active'));
            } else {
                setEmployees(data.filter(u =>
                    u.status === 'active' &&
                    u.id !== user.id &&
                    (u.roles?.includes('crm_em') || u.role === 'crm_em')
                ));
            }
        }).catch(console.error);
    }, [user, api]);

    // Server-side search and pagination
    useEffect(() => {
        const timer = setTimeout(() => {
            searchCrmLeads({
                query: search,
                page,
                limit: PAGE_SIZE,
                tab,
                status: statusFilter,
                payStatus: payFilter,
                starredOnly,
                empFilter
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [search, page, tab, statusFilter, payFilter, starredOnly, empFilter, searchCrmLeads]);

    const totalPages = Math.ceil((crmLeadsTotal || 0) / PAGE_SIZE);
    
    // Strictly enforce that we never render more than PAGE_SIZE items at once
    const currentLeads = (crmLeads || []).slice(0, PAGE_SIZE);

    const handleSave = (data) => {
        // Duplicate mobile number check (only when creating a new lead)
        if (!editingLead) {
            const normalizedNew = (data.whatsapp || '').replace(/\s+/g, '').replace(/^\+/, '');
            const duplicate = crmLeads.find(l => {
                const normalizedExisting = (l.whatsapp || '').replace(/\s+/g, '').replace(/^\+/, '');
                return normalizedExisting && normalizedExisting === normalizedNew;
            });
            if (duplicate) {
                showToast(`❌ A lead with mobile ${data.whatsapp} already exists (${duplicate.name})`, 'error');
                return;
            }
        }

        if (editingLead) {
            updateCrmLead({ ...editingLead, ...data, updatedBy: user.id });
            showToast('Lead updated!');
        }
        else {
            addCrmLead({ ...data, createdBy: user.id });
            showToast('Lead added!');
        }
        setShowModal(false); setEditingLead(null);
    };

    const handleDelete = (id) => { deleteCrmLead(id); setDeletingId(null); showToast('Lead deleted', 'error'); };
    const toggleStar = (lead, e) => { e.stopPropagation(); updateCrmLead({ ...lead, is_starred: !lead.is_starred, updatedBy: user.id }); };

    const handlePassLead = async () => {
        if (!recipientId) return showToast('Please select a recipient', 'error');
        try {
            await updateCrmLead({
                ...passingLead,
                assigned_to: parseInt(recipientId),
                is_passed: true,
                passed_from: user.id,
                updatedBy: user.id
            });
            showToast('Lead passed successfully!');
            setPassingLead(null);
            setRecipientId('');
        } catch (err) {
            showToast('Failed to pass lead: ' + err.message, 'error');
        }
    };

    return (
        <div className="page-content crm-page">
            <div className="crm-header">
                <div>
                    <h1 className="crm-title">Leads ({crmLeadsTotal})</h1>
                    <p className="crm-subtitle">Total leads in current view</p>
                </div>
                <button className="crm-btn crm-btn-primary" onClick={() => { setEditingLead(null); setShowModal(true); }}>+ Add Lead</button>
            </div>

            {/* CRM Tabs */}
            <div className="crm-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--primary-100)', paddingBottom: '8px' }}>
                {['my-leads', 'passing-in', 'passing-out'].map(t => (
                    <button key={t} className={`crm-tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setPage(1); }}>
                        {t.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        {t === 'passing-in' && crmLeads.some(l => l.is_passed && l.assigned_to === user?.id) && (
                            <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: 'var(--danger-500)', borderRadius: '50%', border: '2px solid white' }} />
                        )}
                    </button>
                ))}
            </div>

            {/* Search + Sort */}
            <div className="crm-search-sort-row">
                <input
                    type="text"
                    placeholder="Search name, WhatsApp, location..."
                    className="crm-search-input"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
                <select className="crm-input crm-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="newest">⬇ Newest</option>
                    <option value="oldest">⬆ Oldest</option>
                    <option value="amount-high">💰 Amount High→Low</option>
                    <option value="amount-low">💰 Amount Low→High</option>
                    <option value="name">🔤 Name A–Z</option>
                    <option value="call">⏰ Next Call</option>
                </select>

                {user.role === 'super_admin' && (
                    <select className="crm-input" value={empFilter} onChange={e => { setEmpFilter(e.target.value); setPage(1); }} style={{ maxWidth: '160px' }}>
                        <option value="all">👤 All Employees</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Filters */}
            <div className="crm-filters-row" style={{ marginTop: '0.75rem' }}>
                <div className="crm-filter-pills">
                    <button className={`crm-pill ${starredOnly ? 'active' : ''}`} onClick={() => { setStarredOnly(s => !s); setPage(1); }}>⭐ Starred</button>
                    {[{ v: 'active', l: 'All Active' }, { v: 'all', l: 'All' }, { v: 'hot', l: '🔥 Hot' }, { v: 'warm', l: '🌡️ Warm' }, { v: 'cold', l: '🧊 Cold' }, { v: 'not-interested', l: '👎 Not Interested' }].map(({ v, l }) => (
                        <button key={v} className={`crm-pill ${statusFilter === v ? 'active' : ''}`} onClick={() => { setStatusFilter(v); setPage(1); }}>{l}</button>
                    ))}
                </div>
                <div className="crm-filter-pills">
                    {[{ v: 'all', l: 'All Payments' }, { v: 'pending', l: '⏳ Pending' }, { v: 'paid', l: '✅ Paid' }].map(({ v, l }) => (
                        <button key={v} className={`crm-pill ${payFilter === v ? 'active' : ''}`} onClick={() => { setPayFilter(v); setPage(1); }}>{l}</button>
                    ))}
                </div>
            </div>

            {currentLeads.length === 0 ? (
                <div className="crm-empty-state">
                    <div className="crm-empty-icon">👥</div>
                    <p>{statusFilter === 'active' ? 'Add your first lead!' : 'No leads match these filters.'}</p>
                </div>
            ) : (
                <>
                    {/* ===== DESKTOP TABLE VIEW ===== */}
                    <div className="crm-leads-desktop-table">
                        <table className="data-table crm-leads-table">
                            <thead>
                                <tr>
                                    <th>Lead</th>
                                    <th>Status</th>
                                    <th>Products</th>
                                    <th>Next Call</th>
                                    <th>Amount</th>
                                    <th>Payment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentLeads.map(lead => {
                                    const pending = Math.max(0, (lead.amount || 0) - (lead.paid_amount || 0));
                                    const productNames = (lead.lead_products || []).map(lp => lp.name);
                                    return (
                                        <tr key={lead.id} className="crm-table-row" onClick={() => setViewingLead(lead)} style={{ cursor: 'pointer' }}>
                                            <td>
                                                <div className="crm-table-name-cell">
                                                    <div className="crm-avatar crm-avatar-sm">{lead.name.charAt(0).toUpperCase()}</div>
                                                    <div>
                                                        <div className="crm-card-name">{lead.name}{lead.is_starred ? ' ⭐' : ''}</div>
                                                        <div className="crm-card-location" style={{ fontSize: '0.72rem' }}>📱{lead.whatsapp}{lead.location ? ` · 📍${lead.location}` : ''}</div>
                                                        <div className="crm-card-creator" style={{ fontSize: '0.65rem', color: 'var(--gray-500)', marginTop: '2px' }}>
                                                            👤 {allUsers?.find(e => Number(e.id) === Number(lead.created_by))?.name || 'System'} · 📅 {new Date(lead.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className={`crm-status-badge crm-status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span></td>
                                            <td>
                                                <div className="crm-product-pills">
                                                    {productNames.slice(0, 2).map(n => <span key={n} className="crm-product-pill">{n}</span>)}
                                                    {productNames.length > 2 && <span className="crm-product-pill">+{productNames.length - 2}</span>}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--primary-600)', fontWeight: 500 }}>
                                                {lead.next_call_date ? new Date(lead.next_call_date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                            </td>
                                            <td style={{ fontWeight: 700 }}>{lead.amount > 0 ? `₹${(lead.amount).toLocaleString('en-IN')}` : '—'}</td>
                                            <td>
                                                {lead.amount > 0 ? (
                                                    pending > 0
                                                        ? <span className="crm-pending-badge">⏳ ₹{pending.toLocaleString('en-IN')}</span>
                                                        : <span className="crm-paid-badge">✅ Paid</span>
                                                ) : <span className="crm-no-amount">—</span>}
                                            </td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    <button className="crm-icon-btn" title="Star" onClick={e => toggleStar(lead, e)}>{lead.is_starred ? '⭐' : '☆'}</button>
                                                    <a className="crm-icon-btn" href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">💬</a>
                                                    {lead.instagram && <a className="crm-icon-btn" href={lead.instagram} target="_blank" rel="noopener noreferrer" title="Instagram">📸</a>}
                                                    <button className="crm-icon-btn" title="Edit" onClick={e => { e.stopPropagation(); setEditingLead(lead); setShowModal(true); }}>✏️</button>
                                                    <button className="crm-icon-btn" title="Pass Lead" onClick={e => { e.stopPropagation(); setPassingLead(lead); }}>➡️</button>
                                                    <button className="crm-icon-btn crm-icon-btn-danger" title="Delete" onClick={e => { e.stopPropagation(); setDeletingId(lead.id); }}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* ===== MOBILE CARD VIEW ===== */}
                    <div className="crm-leads-mobile-cards">
                        {currentLeads.map(lead => (
                            <div key={lead.id} className="crm-lead-card" onClick={() => setViewingLead(lead)}>
                                <div className="crm-card-header">
                                    <div className="crm-card-avatar-name">
                                        <div className="crm-avatar">{lead.name.charAt(0).toUpperCase()}</div>
                                        <div>
                                            <div className="crm-card-name">{lead.name}{lead.is_starred ? ' ⭐' : ''}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                                                👤 {allUsers?.find(e => Number(e.id) === Number(lead.created_by))?.name || 'System'} · {new Date(lead.created_at).toLocaleDateString('en-IN')}
                                            </div>
                                            {lead.location && <div className="crm-card-location">📍{lead.location}</div>}
                                        </div>
                                    </div>
                                    <span className={`crm-status-badge crm-status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
                                </div>
                                {(lead.lead_products || []).length > 0 && <div className="crm-card-products">{(lead.lead_products || []).map(n => <span key={n.id} className="crm-product-pill">{n.name}</span>)}</div>}
                                {lead.next_action_message && <div className="crm-card-next-action">💬 <em>{lead.next_action_message.slice(0, 80)}{lead.next_action_message.length > 80 ? '…' : ''}</em></div>}
                                {lead.next_call_date && <div className="crm-card-calldate">⏰ {new Date(lead.next_call_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                                <div className="crm-card-payment">
                                    {lead.amount > 0 ? (Math.max(0, (lead.amount || 0) - (lead.paid_amount || 0)) > 0 ? <span className="crm-pending-badge">⏳ ₹{Math.max(0, (lead.amount || 0) - (lead.paid_amount || 0)).toLocaleString('en-IN')} pending</span> : <span className="crm-paid-badge">✅ Paid</span>) : <span className="crm-no-amount">No amount set</span>}
                                </div>
                                <div className="crm-card-actions" onClick={e => e.stopPropagation()}>
                                    <button className="crm-icon-btn" title="Star" onClick={e => toggleStar(lead, e)}>{lead.is_starred ? '⭐' : '☆'}</button>
                                    <a className="crm-icon-btn" href={`tel:${lead.whatsapp}`} title="Call">📞</a>
                                    <a className="crm-icon-btn" href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">💬</a>
                                    {lead.instagram && <a className="crm-icon-btn" href={lead.instagram} target="_blank" rel="noopener noreferrer" title="Instagram">📸</a>}
                                    <button className="crm-icon-btn" title="Edit" onClick={e => { e.stopPropagation(); setEditingLead(lead); setShowModal(true); }}>✏️</button>
                                    <button className="crm-icon-btn" title="Pass Lead" onClick={e => { e.stopPropagation(); setPassingLead(lead); }}>➡️</button>
                                    <button className="crm-icon-btn crm-icon-btn-danger" title="Delete" onClick={e => { e.stopPropagation(); setDeletingId(lead.id); }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="crm-pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '24px 0', borderTop: '1px solid #eee' }}>
                            <button className="crm-btn crm-btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                            <span style={{ fontSize: '0.9rem', color: '#666' }}>Page {page} of {totalPages} ({crmLeadsTotal} total)</span>
                            <button className="crm-btn crm-btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
                        </div>
                    )}
                </>
            )}

            {showModal && <CrmLeadModal lead={editingLead} onClose={() => { setShowModal(false); setEditingLead(null); }} onSave={handleSave} crmLeads={crmLeads} allUsers={allUsers} />}
            {viewingLead && (
                <CrmLeadDetailModal
                    lead={crmLeads.find(l => l.id === viewingLead.id) || viewingLead}
                    employees={allUsers}
                    onClose={() => setViewingLead(null)}
                    onUpdate={(data) => { updateCrmLead({ ...viewingLead, ...data, updatedBy: user.id }); showToast('Lead updated!'); setViewingLead(null); }}
                />
            )}
            {deletingId && <CrmConfirmDialog message="Delete this lead? This cannot be undone." onConfirm={() => handleDelete(deletingId)} onCancel={() => setDeletingId(null)} />}

            {passingLead && (
                <div className="crm-modal-overlay" onClick={() => setPassingLead(null)}>
                    <div className="crm-modal crm-lead-modal" style={{ width: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <h2 className="crm-modal-title">Pass Lead: {passingLead.name}</h2>
                            <button className="crm-close-btn" onClick={() => setPassingLead(null)}>×</button>
                        </div>
                        <div className="crm-modal-body">
                            <div className="form-group">
                                <label>Target Employee</label>
                                <select
                                    className="crm-input"
                                    value={recipientId}
                                    onChange={e => setRecipientId(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                >
                                    <option value="">Select Employee...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.role_label})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn crm-btn-ghost" onClick={() => setPassingLead(null)}>Cancel</button>
                            <button className="crm-btn crm-btn-primary" onClick={handlePassLead}>Pass Lead</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
