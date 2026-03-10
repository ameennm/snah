import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import CrmLeadModal from './CrmLeadModal';

const STATUS_LABELS = {
    'hot': '🔥 Hot', 'warm': '🌡️ Warm', 'cold': '🧊 Cold', 'not-interested': '👎 Not Interested'
};

function formatCallDate(str) {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function CrmLeadDetailModal({ lead, employees, onClose, onUpdate }) {
    const { products } = useApp();
    const [editing, setEditing] = useState(false);

    const getProductNames = (ids = []) =>
        ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean);

    const pending = Math.max(0, (lead.amount || 0) - (lead.paid_amount || 0));

    if (editing) {
        return (
            <CrmLeadModal
                lead={lead}
                onClose={() => setEditing(false)}
                onSave={(updated) => {
                    onUpdate(updated);
                    setEditing(false);
                    onClose();
                }}
            />
        );
    }

    return (
        <div className="crm-modal-overlay" onClick={onClose}>
            <div className="crm-modal crm-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="crm-modal-header">
                    <div className="crm-detail-header-info">
                        <div className="crm-avatar crm-avatar-lg">{lead.name?.charAt(0)?.toUpperCase()}</div>
                        <div>
                            <h2>{lead.name} {lead.is_starred ? '⭐' : ''}</h2>
                            <span className={`crm-status-badge crm-status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
                        </div>
                    </div>
                    <button className="crm-modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="crm-modal-body crm-detail-body">
                    {/* Contact */}
                    <div className="crm-detail-section">
                        <div className="crm-detail-row">
                            <span className="crm-detail-label">📱 WhatsApp</span>
                            <span className="crm-detail-value">{lead.whatsapp}</span>
                        </div>
                        {lead.location && (
                            <div className="crm-detail-row">
                                <span className="crm-detail-label">📍 Location</span>
                                <span className="crm-detail-value">{lead.location}</span>
                            </div>
                        )}
                        <div className="crm-detail-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--gray-50)' }}>
                            <span className="crm-detail-label">👤 Entered By</span>
                            <span className="crm-detail-value">{employees?.find(e => Number(e.id) === Number(lead.created_by))?.name || 'System'}</span>
                        </div>
                        <div className="crm-detail-row">
                            <span className="crm-detail-label">📅 Created At</span>
                            <span className="crm-detail-value">{new Date(lead.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                    </div>

                    {/* Products */}
                    {lead.lead_products?.length > 0 && (
                        <div className="crm-detail-section">
                            <div className="crm-detail-section-title">🛍️ Products</div>
                            <div className="crm-product-pills">
                                {lead.lead_products.map(lp => (
                                    <span key={lp.id} className="crm-product-pill">{lp.name} (Qty: {lp.qty})</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Next Action Message */}
                    {lead.next_action_message && (
                        <div className="crm-detail-section crm-next-action-section">
                            <div className="crm-detail-section-title">💬 Next Action</div>
                            <div className="crm-next-action-box">{lead.next_action_message}</div>
                        </div>
                    )}

                    {/* Call schedule */}
                    {lead.next_call_date && (
                        <div className="crm-detail-section">
                            <div className="crm-detail-row">
                                <span className="crm-detail-label">⏰ Next Call</span>
                                <span className="crm-detail-value crm-call-date">{formatCallDate(lead.next_call_date)}</span>
                            </div>
                        </div>
                    )}

                    {/* Call Notes */}
                    {lead.call_notes && (
                        <div className="crm-detail-section">
                            <div className="crm-detail-section-title">📝 Call Notes</div>
                            <div className="crm-notes-box">{lead.call_notes}</div>
                        </div>
                    )}

                    {/* Not Interested Reason */}
                    {lead.status === 'not-interested' && lead.not_interested_reason && (
                        <div className="crm-detail-section">
                            <div className="crm-detail-section-title">👎 Not Interested Reason</div>
                            <div className="crm-notes-box crm-notes-red">{lead.not_interested_reason}</div>
                        </div>
                    )}

                    {/* Payment */}
                    <div className="crm-detail-section">
                        <div className="crm-detail-section-title">💰 Payment</div>
                        <div className="crm-detail-row">
                            <span className="crm-detail-label">Status</span>
                            <span className={`crm-pay-badge ${lead.payment_status === 'paid' ? 'paid' : 'pending'}`}>
                                {lead.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                            </span>
                        </div>
                        {lead.amount > 0 && (
                            <>
                                <div className="crm-detail-row">
                                    <span className="crm-detail-label">Total</span>
                                    <span className="crm-detail-value">₹{(lead.amount || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="crm-detail-row">
                                    <span className="crm-detail-label">Paid</span>
                                    <span className="crm-detail-value crm-green">₹{(lead.paid_amount || 0).toLocaleString('en-IN')}</span>
                                </div>
                                {pending > 0 && (
                                    <div className="crm-detail-row">
                                        <span className="crm-detail-label">Pending</span>
                                        <span className="crm-detail-value crm-orange">₹{pending.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="crm-detail-actions">
                    <a
                        href={`tel:${lead.whatsapp}`}
                        className="crm-btn crm-btn-sm crm-btn-ghost"
                    >📞 Call</a>
                    <a
                        href={`https://wa.me/${lead.whatsapp}`}
                        target="_blank" rel="noopener noreferrer"
                        className="crm-btn crm-btn-sm crm-btn-ghost"
                    >💬 WhatsApp</a>
                    <button className="crm-btn crm-btn-sm crm-btn-primary" onClick={() => setEditing(true)}>
                        ✏️ Edit
                    </button>
                    <button className="crm-btn crm-btn-sm crm-btn-ghost" onClick={onClose}>✕ Close</button>
                </div>
            </div>
        </div>
    );
}
