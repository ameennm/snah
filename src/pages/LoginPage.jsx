import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
    const { login } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);
        if (!result.success) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <h1>SNAH</h1>
                    <p>Inventory Management System</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            placeholder="Enter username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading}
                        id="login-submit"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-hint">
                    <strong>Demo Accounts:</strong><br />
                    admin / admin123 (Super Admin)<br />
                    employee1 / emp123 (Order Creator)<br />
                    employee2 / emp456 (Tracking Manager)
                </div>
            </div>
        </div>
    );
}
