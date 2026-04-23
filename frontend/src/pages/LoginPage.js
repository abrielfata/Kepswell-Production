import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import './LoginPage.css';

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Email dan Password wajib diisi');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Format email tidak valid');
            return;
        }

        setLoading(true);
        const result = await login(email, password);
        setLoading(false);

        if (result.success) {
            if (result.user.role === 'MANAGER') {
                navigate('/manager');
            } else if (result.user.role === 'HOST') {
                navigate('/host');
            }
        } else {
            setError(result.message || 'Login failed. Please check your credentials.');
        }
    };

    return (
        <div className="login-page">
            {/* Left Panel — Branding */}
            <div className="login-left">
                <div className="login-left-content">
                    <div className="brand-logo">KW</div>
                    <h1>Kepswell</h1>
                    <p className="brand-tagline">Live Session Reporting System</p>
                    <p className="brand-desc">
                        Platform manajemen performa host live streaming berbasis Telegram Bot
                        dengan laporan GMV real-time dan terintegrasi OCR.
                    </p>
                    <div className="login-divider" />
                    <div className="login-features">
                        <div className="feature-item">Real-time GMV tracking</div>
                        <div className="feature-item">Telegram Bot integration</div>
                        <div className="feature-item">OCR screenshot processing</div>
                        <div className="feature-item">Role-based access control</div>
                    </div>
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="login-right">
                <div className="login-form-wrapper">
                    <div className="login-form-header">
                        <h2>Sign In</h2>
                        <p>Masukkan kredensial Anda untuk melanjutkan</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="password-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="show-pwd-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex="-1"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="form-error">{error}</div>
                        )}

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="login-demo">
                        <p className="demo-title">Demo Accounts</p>
                        <div className="demo-items">
                            <div className="demo-item">
                                <span className="demo-label">Manager</span>
                                <code>manager@example.com</code>
                            </div>
                            <div className="demo-item">
                                <span className="demo-label">Host</span>
                                <code>host@example.com</code>
                            </div>
                            <div className="demo-item">
                                <span className="demo-label">Password</span>
                                <code>password123</code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;