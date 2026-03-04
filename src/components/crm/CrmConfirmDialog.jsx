export default function CrmConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
    return (
        <div className="crm-modal-overlay" onClick={onCancel}>
            <div className="crm-confirm-dialog" onClick={e => e.stopPropagation()}>
                <div className="crm-confirm-icon">⚠️</div>
                <p className="crm-confirm-message">{message}</p>
                <div className="crm-confirm-actions">
                    <button className="crm-btn crm-btn-ghost" onClick={onCancel}>Cancel</button>
                    <button
                        className={`crm-btn ${danger ? 'crm-btn-danger' : 'crm-btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
