import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import usersClient from '../api/usersClient';
import './Sidebar.css';

function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Ambil pendingCount dari SocketContext (real-time via WebSocket)
    const { pendingCount: socketPendingCount, setPendingCount } = useSocket();
    const [pendingCount, setPendingCountLocal] = useState(0);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Fetch awal pending count saat komponen mount (untuk Manager)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (user?.role === 'MANAGER') {
            fetchPendingCount();
        }
        // Tidak ada setInterval — update berikutnya via WebSocket (users:pendingCountChanged)
    }, [user]);

    // Sync dengan nilai yang datang dari SocketContext
    useEffect(() => {
        if (socketPendingCount !== null) {
            setPendingCountLocal(socketPendingCount);
        }
    }, [socketPendingCount]);

    const fetchPendingCount = async () => {
        try {
            const response = await usersClient.getPending();
            const total = response.data.total ?? 0;
            setPendingCountLocal(total);
            setPendingCount(total); // sync ke SocketContext juga
        } catch (error) {
            console.error('Error fetching pending count:', error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
    const toggleMobile  = () => setMobileOpen(!mobileOpen);

    const sidebarClass = [
        'sidebar',
        sidebarCollapsed ? 'collapsed' : '',
        mobileOpen       ? 'mobile-open' : '',
    ].filter(Boolean).join(' ');

    return (
        <>
            {/* Mobile hamburger */}
            <button className="mobile-menu-btn" onClick={toggleMobile} aria-label="Open menu">
                <span className="hamburger-line" />
                <span className="hamburger-line" />
                <span className="hamburger-line" />
            </button>

            {/* Sidebar */}
            <div className={sidebarClass}>

                {/* Header / Brand */}
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="brand-monogram">
                            {sidebarCollapsed ? 'K' : 'KW'}
                        </div>
                        {!sidebarCollapsed && (
                            <div className="brand-text">
                                <span className="brand-name">Kepswell</span>
                                <span className="brand-sub">Live Reporting</span>
                            </div>
                        )}
                    </div>
                    <button
                        className="sidebar-toggle"
                        onClick={toggleSidebar}
                        title={sidebarCollapsed ? 'Expand' : 'Collapse'}
                    >
                        {sidebarCollapsed ? '›' : '‹'}
                    </button>
                </div>

                {/* User Profile */}
                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    {!sidebarCollapsed && (
                        <div className="profile-info">
                            <div className="profile-name">{user?.full_name || user?.username}</div>
                            <div className="profile-role-badge">
                                {user?.role === 'MANAGER' ? 'Manager' : 'Host'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {!sidebarCollapsed && <div className="nav-label">Navigation</div>}

                    {user?.role === 'MANAGER' ? (
                        <>
                            <NavLink
                                to="/manager"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                title="Dashboard"
                                onClick={() => setMobileOpen(false)}
                            >
                                <span className="nav-text">Dashboard</span>
                            </NavLink>

                            <NavLink
                                to="/hosts"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                title="Host Management"
                                onClick={() => setMobileOpen(false)}
                            >
                                <span className="nav-text">Host Management</span>
                            </NavLink>

                            <NavLink
                                to="/users"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                title="Pending Users"
                                onClick={() => setMobileOpen(false)}
                            >
                                <span className="nav-text">Pending Users</span>
                                {pendingCount > 0 && !sidebarCollapsed && (
                                    <span className="nav-badge">{pendingCount}</span>
                                )}
                                {pendingCount > 0 && sidebarCollapsed && (
                                    <span className="nav-badge-dot" />
                                )}
                            </NavLink>
                        </>
                    ) : (
                        <NavLink
                            to="/host"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            title="My Dashboard"
                            onClick={() => setMobileOpen(false)}
                        >
                            <span className="nav-text">My Dashboard</span>
                        </NavLink>
                    )}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={handleLogout} title="Logout">
                        <span className="nav-text">Logout</span>
                    </button>
                    {!sidebarCollapsed && <div className="sidebar-version">v1.0.0</div>}
                </div>
            </div>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={toggleMobile} />
            )}
        </>
    );
}

export default Sidebar;