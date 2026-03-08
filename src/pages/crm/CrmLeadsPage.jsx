import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import CrmLeadModal from '../../components/crm/CrmLeadModal';
import CrmLeadDetailModal from '../../components/crm/CrmLeadDetailModal';
import CrmConfirmDialog from '../../components/crm/CrmConfirmDialog';
import { showToast } from '../../components/crm/CrmToast';

const STATUS_LABELS = { 'hot': '🔥 Hot', 'warm': '🌡️ Warm', 'cold': '🧊 Cold', 'not-interested': '👎 Not Interested' };

export default function CrmLeadsPage() {
    const { crmLeads, products, addCrmLead, updateCrmLead, deleteCrmLead, addOrder, addCustomerAsync, customers, user } = useApp();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [payFilter, setPayFilter] = useState('all');
    const [starredOnly, setStarredOnly] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [showModal, setShowModal] = useState(false);
    const [editingLead, setEditingLead] = useState(null);
    const [viewingLead, setViewingLead] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const getProductNames = (ids = []) => ids.map(id => products.find(p => p.id === id || p.id === parseInt(id))?.name).filter(Boolean);

    const sorted = useMemo(() => {
        const q = search.toLowerCase();
        let list = crmLeads.filter(l => {
            if (q && !l.name.toLowerCase().includes(q) && !l.whatsapp.includes(q) && !(l.location || '').toLowerCase().includes(q)) return false;
            if (starredOnly && !l.is_starred) return false;
            if (statusFilter === 'active' && l.status === 'not-interested') return false;
            if (statusFilter !== 'active' && statusFilter !== 'all' && l.status !== statusFilter) return false;
            if (payFilter === 'pending' && l.payment_status !== 'pending') return false;
            if (payFilter === 'paid' && l.payment_status !== 'paid') return false;
            return true;
        });
        if (sortBy === 'newest') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (sortBy === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        if (sortBy === 'amount-high') list = [...list].sort((a, b) => (b.amount || 0) - (a.amount || 0));
        if (sortBy === 'amount-low') list = [...list].sort((a, b) => (a.amount || 0) - (b.amount || 0));
        if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        if (sortBy === 'call') list = [...list].sort((a, b) => {
            if (!a.next_call_date) return 1; if (!b.next_call_date) return -1;
            return new Date(a.next_call_date) - new Date(b.next_call_date);
        });
        return list;
    }, [crmLeads, search, statusFilter, payFilter, starredOnly, sortBy]);

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

        if (editingLead) { updateCrmLead({ ...editingLead, ...data }); showToast('Lead updated!'); }
        else { addCrmLead(data); showToast('Lead added!'); }
        setShowModal(false); setEditingLead(null);

        // Auto convert if payment was collected
        const paidAmount = parseFloat(data.paid_amount) || 0;
        if (!data.converted && paidAmount > 0) {
            convertToOrder(data);
        }
    };

    const handleDelete = (id) => { deleteCrmLead(id); setDeletingId(null); showToast('Lead deleted', 'error'); };
    const toggleStar = (lead, e) => { e.stopPropagation(); updateCrmLead({ ...lead, is_starred: !lead.is_starred }); };

    // Convert paid lead → create customer + order
    const convertToOrder = async (lead, e) => {
        if (e) e.stopPropagation();
        if (!lead.lead_products || lead.lead_products.length === 0) { showToast('No products set on this lead', 'error'); return; }
        try {
            // Find or create customer
            let customer = customers.find(c => c.phone && (c.phone.includes(lead.whatsapp) || lead.whatsapp.includes(c.phone)));
            if (!customer) {
                customer = await addCustomerAsync({ name: lead.name, phone: lead.whatsapp, address: lead.location || '', area: lead.location || '' });
            }
            const validProducts = lead.lead_products.filter(lp => products.some(p => p.id === parseInt(lp.id, 10)));
            if (validProducts.length === 0) {
                showToast('Products no longer exist in ERP, cannot create order', 'error');
                return;
            }
            const items = validProducts.map(lp => ({
                productId: parseInt(lp.id, 10), quantity: Math.max(1, parseInt(lp.qty, 10) || 1), price: Number(lp.price) || 0, gst: 0
            }));
            const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
            await addOrder({
                customerId: parseInt(customer.id, 10),
                items, subtotal, gstAmount: 0, total: subtotal,
                paidAmount: lead.paid_amount || 0,
                paymentStatus: lead.payment_status === 'paid' ? 'paid' : lead.paid_amount > 0 ? 'partial' : 'not_paid',
                createdBy: user?.id || 1,
            });
            updateCrmLead({ ...lead, converted: true });
            showToast('✅ Order created from lead!');
        } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    };

    const pendingCount = crmLeads.filter(l => l.payment_status === 'pending' && l.status !== 'not-interested').length;

    return (
        <div className="page-content crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">👥 Leads</h1>
                    <p className="crm-page-subtitle">{sorted.length} leads{pendingCount > 0 ? ` · ${pendingCount} pending payment` : ''}</p>
                </div>
                <button className="crm-btn crm-btn-primary" onClick={() => { setEditingLead(null); setShowModal(true); }}>+ Add Lead</button>
            </div>

            {/* Search + Sort */}
            <div className="crm-search-sort-row">
                <input className="crm-search-input" style={{ marginBottom: 0, flex: 1 }} placeholder="🔍 Search name, WhatsApp, location..." value={search} onChange={e => setSearch(e.target.value)} />
                <select className="crm-input crm-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="newest">⬇ Newest</option>
                    <option value="oldest">⬆ Oldest</option>
                    <option value="amount-high">💰 Amount High→Low</option>
                    <option value="amount-low">💰 Amount Low→High</option>
                    <option value="name">🔤 Name A–Z</option>
                    <option value="call">⏰ Next Call</option>
                </select>
            </div>

            {/* Filters */}
            <div className="crm-filters-row" style={{ marginTop: '0.75rem' }}>
                <div className="crm-filter-pills">
                    <button className={`crm-pill ${starredOnly ? 'active' : ''}`} onClick={() => setStarredOnly(s => !s)}>⭐ Starred</button>
                    {[{ v: 'active', l: 'All Active' }, { v: 'hot', l: '🔥 Hot' }, { v: 'warm', l: '🌡️ Warm' }, { v: 'cold', l: '🧊 Cold' }, { v: 'not-interested', l: '👎 Not Interested' }].map(({ v, l }) => (
                        <button key={v} className={`crm-pill ${statusFilter === v ? 'active' : ''}`} onClick={() => setStatusFilter(v)}>{l}</button>
                    ))}
                </div>
                <div className="crm-filter-pills">
                    {[{ v: 'all', l: 'All Payments' }, { v: 'pending', l: '⏳ Pending' }, { v: 'paid', l: '✅ Paid' }].map(({ v, l }) => (
                        <button key={v} className={`crm-pill ${payFilter === v ? 'active' : ''}`} onClick={() => setPayFilter(v)}>{l}</button>
                    ))}
                </div>
            </div>

            {sorted.length === 0 ? (
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
                                {sorted.map(lead => {
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
                                                    {lead.payment_status === 'paid' && lead.lead_products?.length > 0 && (
                                                        <button className="crm-icon-btn" title="Create Order" onClick={e => convertToOrder(lead, e)}>🧾</button>
                                                    )}
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
                        {sorted.map(lead => {
                            const pending = Math.max(0, (lead.amount || 0) - (lead.paid_amount || 0));
                            const productNames = (lead.lead_products || []).map(lp => lp.name);
                            return (
                                <div key={lead.id} className="crm-lead-card" onClick={() => setViewingLead(lead)}>
                                    <div className="crm-card-header">
                                        <div className="crm-card-avatar-name">
                                            <div className="crm-avatar">{lead.name.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div className="crm-card-name">{lead.name}{lead.is_starred ? ' ⭐' : ''}</div>
                                                {lead.location && <div className="crm-card-location">📍{lead.location}</div>}
                                            </div>
                                        </div>
                                        <span className={`crm-status-badge crm-status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
                                    </div>
                                    {productNames.length > 0 && <div className="crm-card-products">{productNames.map(n => <span key={n} className="crm-product-pill">{n}</span>)}</div>}
                                    {lead.next_action_message && <div className="crm-card-next-action">💬 <em>{lead.next_action_message.slice(0, 80)}{lead.next_action_message.length > 80 ? '…' : ''}</em></div>}
                                    {lead.next_call_date && <div className="crm-card-calldate">⏰ {new Date(lead.next_call_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                                    <div className="crm-card-payment">
                                        {lead.amount > 0 ? (pending > 0 ? <span className="crm-pending-badge">⏳ ₹{pending.toLocaleString('en-IN')} pending</span> : <span className="crm-paid-badge">✅ Paid</span>) : <span className="crm-no-amount">No amount set</span>}
                                    </div>
                                    <div className="crm-card-actions" onClick={e => e.stopPropagation()}>
                                        <button className="crm-icon-btn" title="Star" onClick={e => toggleStar(lead, e)}>{lead.is_starred ? '⭐' : '☆'}</button>
                                        <a className="crm-icon-btn" href={`tel:${lead.whatsapp}`} title="Call">📞</a>
                                        <a className="crm-icon-btn" href={`https://wa.me/${lead.whatsapp}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">💬</a>
                                        {lead.instagram && <a className="crm-icon-btn" href={lead.instagram} target="_blank" rel="noopener noreferrer" title="Instagram">📸</a>}
                                        <button className="crm-icon-btn" title="Edit" onClick={e => { e.stopPropagation(); setEditingLead(lead); setShowModal(true); }}>✏️</button>
                                        {lead.payment_status === 'paid' && lead.lead_products?.length > 0 && <button className="crm-icon-btn" title="Create Order" onClick={e => convertToOrder(lead, e)}>🧾</button>}
                                        <button className="crm-icon-btn crm-icon-btn-danger" title="Delete" onClick={e => { e.stopPropagation(); setDeletingId(lead.id); }}>🗑️</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {showModal && <CrmLeadModal lead={editingLead} onClose={() => { setShowModal(false); setEditingLead(null); }} onSave={handleSave} crmLeads={crmLeads} />}
            {viewingLead && <CrmLeadDetailModal lead={crmLeads.find(l => l.id === viewingLead.id) || viewingLead} onClose={() => setViewingLead(null)} onUpdate={(data) => { updateCrmLead({ ...viewingLead, ...data }); showToast('Lead updated!'); setViewingLead(null); }} />}
            {deletingId && <CrmConfirmDialog message="Delete this lead? This cannot be undone." onConfirm={() => handleDelete(deletingId)} onCancel={() => setDeletingId(null)} />}
        </div>
    );
}
