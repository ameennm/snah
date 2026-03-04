import { useEffect, useState } from 'react';

let toastListeners = [];
let toastQueue = [];

export function showToast(message, type = 'success') {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };
    toastQueue = [...toastQueue, toast];
    toastListeners.forEach(fn => fn([...toastQueue]));
    setTimeout(() => {
        toastQueue = toastQueue.filter(t => t.id !== id);
        toastListeners.forEach(fn => fn([...toastQueue]));
    }, 3200);
}

export default function CrmToast() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handler = (list) => setToasts([...list]);
        toastListeners.push(handler);
        return () => { toastListeners = toastListeners.filter(fn => fn !== handler); };
    }, []);

    if (!toasts.length) return null;

    return (
        <div className="crm-toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`crm-toast crm-toast-${t.type}`}>
                    <span className="crm-toast-icon">{t.type === 'success' ? '✓' : '✕'}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}
