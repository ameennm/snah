import { useState, useEffect, useCallback } from 'react';
import { useApp, API_BASE } from '../../context/AppContext';

const STATUS_OPTIONS = [
    { value: 'hot', label: '🔥 Hot' },
    { value: 'warm', label: '🌡️ Warm' },
    { value: 'cold', label: '🧊 Cold' },
    { value: 'not-interested', label: '👎 Not Interested' },
];

const MSG_CATEGORIES = [
    { key: 'greeting', label: '👋 Greeting' },
    { key: 'intro', label: '🎯 Intro' },
    { key: 'video', label: '🎥 Video' },
    { key: 'product', label: '🛍️ Product' },
    { key: 'reviews', label: '⭐ Reviews' },
    { key: 'offer', label: '🏷️ Offer' },
    { key: 'payment', label: '💳 Payment' },
];

function todayAt5pm() {
    const d = new Date(); d.setHours(17, 0, 0, 0); return d;
}
function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtTime(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

const EMPTY = {
    name: '', whatsapp: '', instagram: '', location: '', status: 'hot',
    interested_products: [], lead_products: [],
    next_call_date: '', next_action_message: '',
    call_notes: '', not_interested_reason: '', sent_messages: [],
    payment_status: 'pending', amount: '', paid_amount: '',
};

export default function CrmLeadModal({ lead, onClose, onSave, crmLeads = [], allUsers = [] }) {
    const { products } = useApp();
    const [form, setForm] = useState(EMPTY);
    const [callDate, setCallDate] = useState(fmt(todayAt5pm()));
    const [callTime, setCallTime] = useState(fmtTime(todayAt5pm()));
    const [hasCallDate, setHasCallDate] = useState(false);
    const [msgTemplates, setMsgTemplates] = useState([]);
    const [activeMsgCat, setActiveMsgCat] = useState('greeting');
    const [showMsgPanel, setShowMsgPanel] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/crm/messages`)
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) setMsgTemplates(data);
                else setMsgTemplates([]);
            })
            .catch(() => setMsgTemplates([]));
    }, []);

    useEffect(() => {
        if (lead) {
            setForm({
                name: lead.name || '', whatsapp: lead.whatsapp || '', instagram: lead.instagram || '',
                location: lead.location || '', status: lead.status || 'hot',
                interested_products: lead.interested_products || [],
                lead_products: lead.lead_products || [], sent_messages: lead.sent_messages || [],
                next_call_date: lead.next_call_date || '',
                next_action_message: lead.next_action_message || '',
                call_notes: lead.call_notes || '',
                not_interested_reason: lead.not_interested_reason || '',
                payment_status: lead.payment_status || 'pending',
                amount: lead.amount || '', paid_amount: lead.paid_amount || '',
            });
            if (lead.next_call_date) {
                setHasCallDate(true);
                const d = new Date(lead.next_call_date);
                if (!isNaN(d)) { setCallDate(fmt(d)); setCallTime(fmtTime(d)); }
            }
        } else {
            setForm(EMPTY);
            setHasCallDate(false);
        }
    }, [lead]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Product qty selection
    const getLeadProduct = (pid) => form.lead_products.find(p => p.id === pid);
    const setProductQty = (product, qty) => {
        const newList = qty > 0
            ? form.lead_products.filter(p => p.id !== product.id).concat({ id: product.id, qty, price: product.sellingPrice || 0, name: product.name })
            : form.lead_products.filter(p => p.id !== product.id);
        set('lead_products', newList);
        // Auto-update total amount
        const total = newList.reduce((s, p) => s + (p.qty * (p.price || 0)), 0);
        set('amount', total || '');
    };

    const leadTotal = form.lead_products.reduce((s, p) => s + (p.qty * (p.price || 0)), 0);
    const pendingAmount = () => Math.max(0, (parseFloat(form.amount) || 0) - (parseFloat(form.paid_amount) || 0));

    // Messages
    const catTemplates = msgTemplates.filter(t => t.category === activeMsgCat);
    const sendViaWhatsApp = (msg) => {
        if (!form.whatsapp) return;
        window.open(`https://wa.me/${form.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
    };
    const sendViaInstagram = (instagramUrl) => {
        if (!instagramUrl && !form.instagram) return;
        window.open(instagramUrl || form.instagram, '_blank');
    };

    const toggleSentCategory = (catKey) => {
        set('sent_messages', form.sent_messages.includes(catKey)
            ? form.sent_messages.filter(k => k !== catKey)
            : [...form.sent_messages, catKey]);
    };

    // Real-time duplicate check (only for new leads)
    const duplicateLead = !lead && form.whatsapp.trim() ? (() => {
        const normalized = form.whatsapp.trim().replace(/\s+/g, '').replace(/^\+/, '');
        return crmLeads.find(l => {
            const existing = (l.whatsapp || '').replace(/\s+/g, '').replace(/^\+/, '');
            return existing && existing === normalized;
        });
    })() : null;

    const duplicateCreator = duplicateLead ? (allUsers?.find(u => Number(u.id) === Number(duplicateLead.created_by))?.name || 'System') : null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.whatsapp.trim()) return;
        if (duplicateLead) return;
        const amount = parseFloat(form.amount) || 0;
        const paid = parseFloat(form.paid_amount) || 0;
        const autoPayStatus = paid >= amount && amount > 0 ? 'paid' : (paid > 0 && paid < amount ? 'partial' : form.payment_status);
        const nextCallDate = hasCallDate && callDate ? `${callDate}T${callTime || '17:00'}` : '';
        onSave({ ...(lead || {}), ...form, amount, paid_amount: paid, pending_amount: Math.max(0, amount - paid), payment_status: autoPayStatus, next_call_date: nextCallDate });
    };


    return (
        <div className="crm-modal-overlay" onClick={onClose}>
            <div className="crm-modal" onClick={e => e.stopPropagation()}>
                <div className="crm-modal-header">
                    <h2>{lead ? '✏️ Edit Lead' : '➕ New Lead'}</h2>
                    <button className="crm-modal-close" onClick={onClose}>✕</button>
                </div>

                <form className="crm-modal-body" onSubmit={handleSubmit}>
                    {/* Contact Info */}
                    <div className="crm-form-section">
                        <div className="crm-form-section-title">👤 Contact Info</div>
                        <div className="crm-form-row">
                            <div className="crm-form-group">
                                <label>Name *</label>
                                <input type="text" className="crm-input" placeholder="Lead name" value={form.name} onChange={e => set('name', e.target.value)} required />
                            </div>
                            <div className="crm-form-group">
                                <label>WhatsApp *</label>
                                <input
                                    type="tel"
                                    className={`crm-input${duplicateLead ? ' crm-input-error' : ''}`}
                                    placeholder="91XXXXXXXXXX"
                                    value={form.whatsapp}
                                    onChange={e => set('whatsapp', e.target.value)}
                                    required
                                />
                                {duplicateLead && (
                                    <div style={{
                                        marginTop: '0.35rem',
                                        padding: '0.4rem 0.65rem',
                                        background: 'rgba(239,68,68,0.12)',
                                        border: '1px solid rgba(239,68,68,0.4)',
                                        borderRadius: '6px',
                                        color: '#f87171',
                                        fontSize: '0.78rem',
                                        fontWeight: 500,
                                    }}>
                                        ⚠️ Mobile number exists in lead: <strong>{duplicateLead.name}</strong><br />
                                        👤 Created by: <strong>{duplicateCreator}</strong>
                                    </div>
                                )}

                            </div>
                        </div>
                        <div className="crm-form-row">
                            <div className="crm-form-group">
                                <label>Location</label>
                                <input type="text" className="crm-input" placeholder="City / Area" value={form.location} onChange={e => set('location', e.target.value)} />
                            </div>
                            <div className="crm-form-group">
                                <label>Instagram Profile URL</label>
                                <input type="url" className="crm-input" placeholder="https://instagram.com/username" value={form.instagram} onChange={e => set('instagram', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="crm-form-section">
                        <div className="crm-form-section-title">📊 Lead Status</div>
                        <div className="crm-status-selector">
                            {STATUS_OPTIONS.map(opt => (
                                <button key={opt.value} type="button"
                                    className={`crm-status-btn crm-status-${opt.value} ${form.status === opt.value ? 'active' : ''}`}
                                    onClick={() => set('status', opt.value)}
                                >{opt.label}</button>
                            ))}
                        </div>
                        {form.status === 'not-interested' && (
                            <div className="crm-form-group" style={{ marginTop: '0.75rem' }}>
                                <label>Reason</label>
                                <textarea className="crm-input crm-textarea" rows={2} placeholder="Why not interested?" value={form.not_interested_reason} onChange={e => set('not_interested_reason', e.target.value)} />
                            </div>
                        )}
                    </div>

                    {/* Products with Qty */}
                    <div className="crm-form-section">
                        <div className="crm-form-section-title">🛍️ Products &amp; Quantities</div>
                        {(() => {
                            const availableProducts = products.filter(p => p.stock > 0 || getLeadProduct(p.id));
                            if (availableProducts.length === 0) return <span className="crm-muted">No products available in ERP.</span>;
                            return (
                                <div className="crm-lead-products-list">
                                    {availableProducts.map(p => {
                                        const lp = getLeadProduct(p.id);
                                        return (
                                            <div key={p.id} className={`crm-lead-product-row ${lp ? 'selected' : ''}`}>
                                                <div className="crm-lead-product-info">
                                                    <span className="crm-lead-product-name">{p.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(Stock: {p.stock || 0})</span></span>
                                                    {p.sellingPrice > 0 && <span className="crm-lead-product-price">₹{p.sellingPrice}</span>}
                                                </div>
                                                <div className="crm-lead-product-qty">
                                                    <button type="button" className="crm-qty-btn" onClick={() => setProductQty(p, Math.max(0, (lp?.qty || 0) - 1))}>−</button>
                                                    <span className="crm-qty-val">{lp?.qty || 0}</span>
                                                    <button type="button" className="crm-qty-btn" onClick={() => setProductQty(p, (lp?.qty || 0) + 1)}>+</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                        {leadTotal > 0 && (
                            <div className="crm-lead-total">
                                💰 Estimated Total: <strong>₹{leadTotal.toLocaleString('en-IN')}</strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: 8 }}>(auto-filled below)</span>
                            </div>
                        )}

                    </div>

                    {/* Message Templates */}
                    <div className="crm-form-section">
                        <div className="crm-form-section-title">📨 Send Message Templates</div>
                        <div className="crm-msg-vertical-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {MSG_CATEGORIES.map(c => {
                                const isSent = form.sent_messages.includes(c.key);
                                const templates = msgTemplates.filter(t => t.category === c.key);
                                return (
                                    <div key={c.key} className="crm-msg-vertical-item" style={{ background: 'var(--bg-secondary)', border: `1px solid ${isSent ? 'var(--primary-500)' : 'var(--border-color)'}`, borderRadius: '8px', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: isSent ? 'var(--bg-card)' : 'transparent' }}>
                                            <label className="crm-checkbox" style={{ margin: 0 }}>
                                                <input type="checkbox" checked={isSent} onChange={() => toggleSentCategory(c.key)} />
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSent ? 'var(--primary-400)' : 'var(--text-primary)' }}>{c.label}</span>
                                            </label>
                                        </div>
                                        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                            {templates.length === 0 ? (
                                                <div className="crm-muted">No messages. Add them in Custom Messages.</div>
                                            ) : (
                                                <div className="crm-msg-template-list">
                                                    {templates.map(t => (
                                                        <div key={t.id} className="crm-msg-template-item">
                                                            <div className="crm-msg-template-title">{t.title}</div>
                                                            <div className="crm-msg-template-preview">{t.message.slice(0, 80)}{t.message.length > 80 ? '…' : ''}</div>
                                                            <div className="crm-msg-template-actions">
                                                                <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => sendViaWhatsApp(t.message)} disabled={!form.whatsapp}>💬 WhatsApp</button>
                                                                <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => sendViaInstagram(form.instagram)} disabled={!form.instagram}>📸 Instagram</button>
                                                                <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => navigator.clipboard.writeText(t.message)}>📋 Copy</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Follow-up */}
                    <div className="crm-form-section">
                        <div className="crm-form-section-title">📅 Follow-up</div>
                        <label className="crm-toggle-label">
                            <input type="checkbox" checked={hasCallDate} onChange={e => setHasCallDate(e.target.checked)} />
                            <span>Schedule a follow-up call</span>
                        </label>
                        {hasCallDate && (
                            <div className="crm-form-row" style={{ marginTop: '0.75rem' }}>
                                <div className="crm-form-group">
                                    <label>Date</label>
                                    <input type="date" className="crm-input" value={callDate} onChange={e => setCallDate(e.target.value)} />
                                </div>
                                <div className="crm-form-group">
                                    <label>Time</label>
                                    <input type="time" className="crm-input" value={callTime} onChange={e => setCallTime(e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="crm-form-group" style={{ marginTop: '0.75rem' }}>
                            <label>💬 Next Action Message</label>
                            <textarea className="crm-input crm-textarea" rows={2} placeholder="What to say on next call..." value={form.next_action_message} onChange={e => set('next_action_message', e.target.value)} />
                        </div>
                        <div className="crm-form-group">
                            <label>📝 Call Notes</label>
                            <textarea className="crm-input crm-textarea" rows={2} placeholder="Summary of last call..." value={form.call_notes} onChange={e => set('call_notes', e.target.value)} />
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="crm-form-section">
                        <div className="crm-form-section-title">💰 Payment</div>
                        <div className="crm-payment-toggle">
                            <button type="button" className={`crm-pay-btn ${form.payment_status === 'pending' ? 'active-pending' : ''}`} onClick={() => set('payment_status', 'pending')}>⏳ Pending</button>
                            <button type="button" className={`crm-pay-btn ${form.payment_status === 'partial' ? 'active-partial' : ''}`} style={{ background: form.payment_status === 'partial' ? 'rgba(245, 158, 11, 0.15)' : '', color: form.payment_status === 'partial' ? 'var(--accent-orange)' : '' }} onClick={() => set('payment_status', 'partial')}>➖ Partial</button>
                            <button type="button" className={`crm-pay-btn ${form.payment_status === 'paid' ? 'active-paid' : ''}`} onClick={() => set('payment_status', 'paid')}>✅ Paid</button>
                        </div>
                        <div className="crm-form-row" style={{ marginTop: '0.75rem' }}>
                            <div className="crm-form-group">
                                <label>Total Amount (₹)</label>
                                <input type="number" min="0" step="0.01" className="crm-input" placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
                            </div>
                            <div className="crm-form-group">
                                <label>Paid Amount (₹)</label>
                                <input type="number" min="0" step="0.01" className="crm-input" placeholder="0" value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} />
                            </div>
                        </div>
                        {parseFloat(form.amount) > 0 && (
                            <div className={`crm-pending-display ${pendingAmount() > 0 ? 'has-pending' : 'fully-paid'}`}>
                                {pendingAmount() > 0 ? `⏳ Pending: ₹${pendingAmount().toLocaleString('en-IN')}` : '✅ Fully Paid'}
                            </div>
                        )}
                    </div>

                    <div className="crm-modal-footer">
                        <button type="button" className="crm-btn crm-btn-ghost" onClick={onClose}>Cancel</button>
                        <button
                            type="submit"
                            className="crm-btn crm-btn-primary"
                            disabled={!!duplicateLead}
                            title={duplicateLead ? 'Duplicate mobile number – cannot save' : ''}
                        >{lead ? 'Save Changes' : 'Add Lead'}</button>

                    </div>
                </form>
            </div>
        </div>
    );
}
