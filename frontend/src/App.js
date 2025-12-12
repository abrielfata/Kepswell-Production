import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './utils/AuthContext';
import LoginPage from './pages/LoginPage';
import ManagerDashboard from './pages/ManagerDashboard';
import HostDashboard from './pages/HostDashboard';
import UserManagement from './pages/UserManagement';
import HostManagement from './pages/HostManagement';
import Sidebar from './components/Sidebar'; // ✅ NEW: Import Sidebar

import './App.css';

// Loading Component
function LoadingScreen() {
    return (
        <div className="loading-screen">
            <div className="loading-spinner"></div>
        </div>
    );
}

// 404 Component
function NotFound() {
    return (
        <div className="not-found">
            <h1>404</h1>
            <p>Halaman tidak ditemukan</p>
            <Link to="/">Kembali ke Dashboard</Link>
        </div>
    );
}

// Protected Route Component with Sidebar Layout
function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/login" />;
    }

    // ✅ NEW: Wrap with Sidebar Layout
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                {children}
            </div>
        </div>
    );
}

function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <Router>
            <div className="App">
                <Routes>
                    {/* Route Default */}
                    <Route 
                        path="/" 
                        element={
                            user ? (
                                user.role === 'MANAGER' ? 
                                    <Navigate to="/manager" /> : 
                                    <Navigate to="/host" />
                            ) : (
                                <Navigate to="/login" />
                            )
                        } 
                    />
                    
                    {/* Route Login */}
                    <Route path="/login" element={<LoginPage />} />
                    
                    {/* Protected Route: Manager Dashboard */}
                    <Route 
                        path="/manager" 
                        element={
                            <ProtectedRoute allowedRoles={['MANAGER']}>
                                <ManagerDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Protected Route: User Management */}
                    <Route 
                        path="/users" 
                        element={
                            <ProtectedRoute allowedRoles={['MANAGER']}>
                                <UserManagement />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Protected Route: Host Management */}
                    <Route 
                        path="/hosts" 
                        element={
                            <ProtectedRoute allowedRoles={['MANAGER']}>
                                <HostManagement />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Protected Route: Host Dashboard */}
                    <Route 
                        path="/host" 
                        element={
                            <ProtectedRoute allowedRoles={['HOST']}>
                                <HostDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Route 404 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;