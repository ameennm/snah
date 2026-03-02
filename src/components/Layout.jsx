import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useApp } from '../context/AppContext';

export default function Layout() {
    const { user, loading } = useApp();

    if (!user) return null;

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'var(--bg-primary)',
                flexDirection: 'column',
                gap: '16px',
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid var(--primary-100)',
                    borderTopColor: 'var(--primary-600)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading data...</p>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Header />
                <div className="page-content">
                    <Outlet />
                </div>
                <BottomNav />
            </main>
        </div>
    );
}

