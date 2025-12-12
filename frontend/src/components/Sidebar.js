import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import usersClient from '../api/usersClient';
import './Sidebar.css';

function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [pendingCount, setPendingCount] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Fetch pending users count (only for Manager)
    useEffect(() => {
        if (user?.role === 'MANAGER') {
            fetchPendingCount();
            
            // Refresh count every 30 seconds
            const interval = setInterval(fetchPendingCount, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchPendingCount = async () => {
        try {
            const response = await usersClient.getPending();
            setPendingCount(response.data.total);
        } catch (error) {
            console.error('Error fetching pending count:', error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    return (
        <>
            {/* Sidebar */}
            <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                {/* Logo & Title */}
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        {!sidebarCollapsed && (
                            <div className="logo-text">
                                <h2>Live Session</h2>
                                <span>Reporting System</span>
                            </div>
                        )}
                    </div>
                    <button className="sidebar-toggle" onClick={toggleSidebar}>
                        {sidebarCollapsed ? '»' : '«'}
                    </button>
                </div>

                {/* User Profile */}
                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                    </div>
                    {!sidebarCollapsed && (
                        <div className="profile-info">
                            <div className="profile-name">
                                {user?.full_name || user?.username}
                            </div>
                            <div className="profile-role">
                                {user?.role === 'MANAGER' ? 'Manager' : 'Host'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Menu */}
                <nav className="sidebar-nav">
                    {user?.role === 'MANAGER' ? (
                        // Manager Menu
                        <>
                            <div className="nav-section">
                                {!sidebarCollapsed && <div className="nav-section-title">Main Menu</div>}
                                
                                <NavLink 
                                    to="/manager" 
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    title="Dashboard"
                                >
                                    {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
                                </NavLink>
                                
                                <NavLink 
                                    to="/hosts" 
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    title="Host Management"
                                >
                                    {!sidebarCollapsed && <span className="nav-text">Host Management</span>}
                                </NavLink>
                                
                                <NavLink 
                                    to="/users" 
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    title="Pending Users"
                                >
                                    {!sidebarCollapsed && (
                                        <>
                                            <span className="nav-text">Pending Users</span>
                                            {pendingCount > 0 && (
                                                <span className="nav-badge">{pendingCount}</span>
                                            )}
                                        </>
                                    )}
                                    {sidebarCollapsed && pendingCount > 0 && (
                                        <span className="nav-badge-dot"></span>
                                    )}
                                </NavLink>
                            </div>
                        </>
                    ) : (
                        // Host Menu
                        <>
                            <div className="nav-section">
                                {!sidebarCollapsed && <div className="nav-section-title">Main Menu</div>}
                                
                                <NavLink 
                                    to="/host" 
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    title="My Dashboard"
                                >
                                    {!sidebarCollapsed && <span className="nav-text">My Dashboard</span>}
                                </NavLink>
                            </div>
                        </>
                    )}
                </nav>

                {/* Bottom Section */}
                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={handleLogout} title="Logout">
                        {!sidebarCollapsed && <span className="nav-text">Logout</span>}
                    </button>
                    
                    {!sidebarCollapsed && (
                        <div className="sidebar-version">
                            <small>v1.0.0</small>
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay for mobile */}
            {!sidebarCollapsed && (
                <div className="sidebar-overlay" onClick={toggleSidebar}></div>
            )}
        </>
    );
}

export default Sidebar;