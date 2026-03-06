import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

export default function DeliveryPartnersPage() {
    const { user, api } = useApp();
    const [partners, setPartners] = useState([]);
    const [name, setName] = useState('');
    const [template, setTemplate] = useState('');

    useEffect(() => {
        if (user?.role === 'super_admin' || user?.role === 'admin') {
            loadPartners();
        }
    }, [user, api]);

    const loadPartners = async () => {
        try {
            const data = await api('/delivery_partners');
            setPartners(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!name) return;
        try {
            await api('/delivery_partners', { method: 'POST', body: { name: name.trim(), trackingUrlTemplate: template.trim() } });
            setName('');
            setTemplate('');
            loadPartners();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this delivery partner?')) return;
        try {
            await api(`/delivery_partners/${id}`, { method: 'DELETE' });
            loadPartners();
        } catch (error) {
            alert(error.message);
        }
    };

    if (user?.role !== 'super_admin' && user?.role !== 'admin') {
        return <div className="p-4">Access Denied</div>;
    }

    return (
        <div className="card">
            <div className="card-header">
                <h2>Manage Delivery Partners</h2>
            </div>

            <div className="card-body">
                <form onSubmit={handleAdd} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '24px' }}>
                    <div className="form-group">
                        <label>Partner Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. DTDC, BlueDart" />
                    </div>
                    <div className="form-group">
                        <label>Tracking Website Link</label>
                        <input value={template} onChange={e => setTemplate(e.target.value)} placeholder="https://www.dtdc.in/tracking..." />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>
                        <FiPlus /> Add Partner
                    </button>
                </form>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Partner Name</th>
                                <th>Tracking Website Link</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partners.map(dp => (
                                <tr key={dp.id}>
                                    <td className="font-bold">{dp.name}</td>
                                    <td>
                                        {dp.tracking_url_template ? (
                                            <a href={dp.tracking_url_template} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-600)', textDecoration: 'underline' }}>
                                                {dp.tracking_url_template}
                                            </a>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <button className="btn btn-secondary btn-sm btn-icon text-danger" title="Delete" onClick={() => handleDelete(dp.id)}>
                                            <FiTrash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {partners.length === 0 && (
                                <tr>
                                    <td colSpan={3}>
                                        <div className="empty-state">
                                            <h3>No delivery partners</h3>
                                            <p>Add the logistics companies you work with from above form.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
