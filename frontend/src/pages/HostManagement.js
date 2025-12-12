import React, { useState, useEffect, useCallback } from 'react';
import {
    useHostsQuery,
    useUpdateHostMutation,
    useToggleHostStatusMutation,
    useDeleteHostMutation
} from '../hooks/useHosts';
import { useToast } from '../utils/useToast';
import { formatCurrency } from '../utils/format';
import ToastContainer from '../components/ToastContainer';
import './HostManagement.css';

function HostManagement() {
    const [statusFilter, setStatusFilter] = useState('approved'); 
    const [activeFilter, setActiveFilter] = useState('all');
    const hostsQuery = useHostsQuery(statusFilter, activeFilter);
    const { mutateAsync: updateHost } = useUpdateHostMutation();
    const { mutateAsync: toggleHostStatus } = useToggleHostStatusMutation();
    const { mutateAsync: deleteHost } = useDeleteHostMutation();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state - ONLY FOR EDIT
    const [showModal, setShowModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // ✅ NEW: Password toggle
    const [selectedHost, setSelectedHost] = useState(null);
    const [formData, setFormData] = useState({
        telegram_user_id: '',
        username: '',
        full_name: '',
        email: '', // ✅ NEW
        password: '', // ✅ NEW
        is_active: true,
        is_approved: true
    });

    const { toasts, showToast, removeToast } = useToast();

    useEffect(() => {
        // react-query handles fetching automatically when filters change
    }, [statusFilter, activeFilter]);

    // Filter hosts based on search
    const hosts = hostsQuery.data || [];

    const filteredHosts = hosts.filter(host => {
        const searchLower = searchTerm.toLowerCase();
        return (
            host.full_name.toLowerCase().includes(searchLower) ||
            host.username.toLowerCase().includes(searchLower) ||
            host.telegram_user_id.includes(searchLower)
        );
    });

    // Modal handlers - ONLY FOR EDIT
    const openEditModal = (host) => {
        setSelectedHost(host);
        setFormData({
            telegram_user_id: host.telegram_user_id,
            username: host.username,
            full_name: host.full_name,
            email: host.email || '', // ✅ NEW
            password: '', // ✅ NEW: Always empty (optional field)
            is_active: host.is_active,
            is_approved: host.is_approved
        });
        setShowPassword(false); // Reset password visibility
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedHost(null);
        setShowPassword(false); // Reset password visibility
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const refetchHosts = useCallback(() => hostsQuery.refetch(), [hostsQuery]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // ✅ NEW: Validate email format if provided
        if (formData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                showToast('Invalid email format', 'error');
                return;
            }
        }

        // ✅ NEW: Validate password length if provided
        if (formData.password && formData.password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            // ✅ NEW: Only send password if it's not empty
            const updateData = {
                username: formData.username,
                full_name: formData.full_name,
                email: formData.email || undefined, // Send undefined if empty
                is_active: formData.is_active,
                is_approved: formData.is_approved
            };

            // Only include password if user entered a new one
            if (formData.password && formData.password.trim() !== '') {
                updateData.password = formData.password;
            }

            await updateHost(selectedHost.id, updateData);
            
            showToast('Host updated successfully!', 'success');
            
            closeModal();
            refetchHosts();
        } catch (error) {
            console.error('Error updating host:', error);
            
            showToast(error.response?.data?.message || 'Failed to update host', 'error');
        }
    };

    const handleToggleStatus = async (host) => {
        const action = host.is_active ? 'deactivate' : 'activate';
        if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} host "${host.full_name}"?`)) {
            return;
        }

        try {
            await toggleHostStatus(host.id);
            
            showToast(`Host ${action}d successfully!`, 'success');
            
            refetchHosts();
        } catch (error) {
            console.error('Error toggling status:', error);
            
            showToast('Failed to toggle status', 'error');
        }
    };

    const handleDelete = async (host) => {
        if (!window.confirm(`Delete host "${host.full_name}"? This will also delete all their reports. This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteHost(host.id);
            
            showToast('Host deleted successfully!', 'success');
            
            refetchHosts();
        } catch (error) {
            console.error('Error deleting host:', error);
            
            showToast('Failed to delete host', 'error');
        }
    };

    return (
        <div className="host-management">
            <div className="host-management-container">
                <h1>Host Management</h1>
                <p>Manage host accounts and view their performance</p>

                {/* Info Box - How to Add New Host */}
                <div className="info-box">
                    <div className="info-icon">ℹ️</div>
                    <div className="info-content">
                        <strong>How to Add New Host:</strong>
                        <p>New hosts must register through the Telegram Bot by typing <code>/start</code> and providing their full name, email, and password. Once registered, you can approve them in the "Pending Users" menu.</p>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="filter-controls">
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="approved">Approved</option>
                            <option value="pending">Pending</option>
                        </select>

                        <select 
                            value={activeFilter} 
                            onChange={(e) => setActiveFilter(e.target.value)}
                        >
                            <option value="all">All Active Status</option>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>

                        <div className="search-box">
                            <input
                                type="text"
                                placeholder="Search hosts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {hostsQuery.isLoading ? (
                    <div className="loading">Loading hosts...</div>
                ) : (
                    <div className="table-container">
                        <table className="hosts-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Host Info</th>
                                    <th>Status</th>
                                    <th>Performance</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHosts.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="empty-state">
                                            {searchTerm ? 'No hosts found for this search' : 'No hosts available'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHosts.map(host => (
                                        <tr key={host.id}>
                                            <td><strong>#{host.id}</strong></td>
                                            <td>
                                                <div className="host-info-cell">
                                                    <span className="host-name">{host.full_name}</span>
                                                    <span className="host-username">@{host.username}</span>
                                                    <span className="host-telegram-id">{host.telegram_user_id}</span>
                                                    {host.email && (
                                                        <span className="host-email" style={{ 
                                                            fontSize: '11px', 
                                                            color: '#3498db',
                                                            fontFamily: 'Courier New, monospace'
                                                        }}>
                                                            📧 {host.email}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="status-indicators">
                                                    <span className={`status-badge ${host.is_active ? 'active' : 'inactive'}`}>
                                                        {host.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                    <span className={`status-badge ${host.is_approved ? 'approved' : 'pending'}`}>
                                                        {host.is_approved ? 'Approved' : 'Pending'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="stats-cell">
                                                    <div className="stat-item">
                                                        Reports: <strong>{host.stats.total_reports}</strong>
                                                    </div>
                                                    <div className="stat-item">
                                                        Verified: <strong>{host.stats.verified_reports}</strong>
                                                    </div>
                                                    <div className="stat-item">
                                                        GMV: <strong>{formatCurrency(host.stats.total_gmv)}</strong>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button 
                                                        className="btn-action btn-edit"
                                                        onClick={() => openEditModal(host)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        className="btn-action btn-toggle"
                                                        onClick={() => handleToggleStatus(host)}
                                                    >
                                                        {host.is_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button 
                                                        className="btn-action btn-delete"
                                                        onClick={() => handleDelete(host)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal for EDIT ONLY */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Host</h2>
                            <button className="modal-close" onClick={closeModal}>×</button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Telegram User ID</label>
                                    <input
                                        type="text"
                                        name="telegram_user_id"
                                        value={formData.telegram_user_id}
                                        disabled
                                        style={{ 
                                            background: '#f5f5f5', 
                                            cursor: 'not-allowed',
                                            color: '#999'
                                        }}
                                    />
                                    <small style={{ color: '#999', fontSize: '12px' }}>
                                        Cannot be changed
                                    </small>
                                </div>

                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleFormChange}
                                        placeholder="e.g., john_doe"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Full Name *</label>
                                    <input
                                        type="text"
                                        name="full_name"
                                        value={formData.full_name}
                                        onChange={handleFormChange}
                                        required
                                        placeholder="e.g., John Doe"
                                    />
                                </div>

                                {/* ✅ NEW: Email Field */}
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleFormChange}
                                        placeholder="e.g., host@example.com"
                                    />
                                    <small style={{ color: '#666', fontSize: '12px' }}>
                                        Used for dashboard login
                                    </small>
                                </div>

                                {/* ✅ NEW: Password Field (Optional) */}
                                <div className="form-group">
                                    <label>New Password (optional)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleFormChange}
                                            placeholder="Leave empty to keep current password"
                                            style={{ paddingRight: '45px' }}
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
                                    <small style={{ color: '#666', fontSize: '12px' }}>
                                        Minimum 6 characters
                                    </small>
                                </div>

                                <div className="form-group">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="is_active"
                                            name="is_active"
                                            checked={formData.is_active}
                                            onChange={handleFormChange}
                                        />
                                        <label htmlFor="is_active">Active</label>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="checkbox-group">
                                        <input
                                            type="checkbox"
                                            id="is_approved"
                                            name="is_approved"
                                            checked={formData.is_approved}
                                            onChange={handleFormChange}
                                        />
                                        <label htmlFor="is_approved">Approved</label>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-modal btn-cancel" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-modal btn-submit">
                                    Update Host
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}

export default HostManagement;