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
        
        // Validasi input
        if (!email || !password) {
            setError('Email dan Password wajib diisi');
            return;
        }

        // Validasi format email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Format email tidak valid');
            return;
        }

        setLoading(true);

        // Call login API
        const result = await login(email, password);

        setLoading(false);

        if (result.success) {
            // Redirect based on role
            if (result.user.role === 'MANAGER') {
                navigate('/manager');
            } else if (result.user.role === 'HOST') {
                navigate('/host');
            }
        } else {
            setError(result.message || 'Login failed');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>Live Session Reporting</h1>
                <p className="subtitle">Please sign in to continue</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                style={{ paddingRight: '45px' }}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: '#7f8c8d',
                                    padding: '5px'
                                }}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading}>
                        {loading ? 'Loading...' : 'Login'}
                    </button>
                </form>

                <div className="login-info">
                    <p><strong>Demo Accounts</strong></p>
                    <p>Manager: <code>manager@example.com</code></p>
                    <p>Host: <code>host@example.com</code></p>
                    <p>Password: <code>password123</code></p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;