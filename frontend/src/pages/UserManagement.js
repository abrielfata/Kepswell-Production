import React from 'react';
import {
    usePendingUsersQuery,
    useApproveUserMutation,
    useRejectUserMutation
} from '../hooks/useUsers';
import { useToast } from '../utils/useToast';
import ToastContainer from '../components/ToastContainer';
import './UserManagement.css';

function UserManagement() {
    const { data: pendingData, isLoading } = usePendingUsersQuery();
    const { mutateAsync: approveUser } = useApproveUserMutation();
    const { mutateAsync: rejectUser } = useRejectUserMutation();
    const pendingUsers = pendingData?.data || [];
    const { toasts, showToast, removeToast } = useToast();

    const handleApprove = async (userId, userName) => {
        if (!window.confirm(`Approve user "${userName}"?`)) {
            return;
        }

        try {
            await approveUser(userId);
            showToast(`User "${userName}" has been approved!`, 'success');
        } catch (error) {
            console.error('Error approving user:', error);
            
            // ✅ 4. Replace alert with Toast (Error)
            showToast('Failed to approve user', 'error');
        }
    };

    const handleReject = async (userId, userName) => {
        if (!window.confirm(`Reject and delete user "${userName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await rejectUser(userId);
            showToast(`User "${userName}" has been rejected and deleted.`, 'success');
        } catch (error) {
            console.error('Error rejecting user:', error);
            
            // ✅ 6. Replace alert with Toast (Error)
            showToast('Failed to reject user', 'error');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="user-management">
            <div className="user-management-container">
                <h1>User Management</h1>
                <p>Review and approve new user registrations</p>

                <div className="section-header">
                    <h2>Pending Approvals</h2>
                    {pendingUsers.length > 0 && (
                        <span className="pending-count">
                            {pendingUsers.length} pending
                        </span>
                    )}
                </div>

                {isLoading ? (
                    <div className="loading">Loading pending users...</div>
                ) : (
                    <div className="users-grid">
                        {pendingUsers.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">✅</div>
                                <h3>All Caught Up!</h3>
                                <p>No pending user approvals at the moment.</p>
                            </div>
                        ) : (
                            pendingUsers.map(user => (
                                <div key={user.id} className="user-card">
                                    <div className="user-card-header">
                                        <div className="user-info">
                                            <h3>{user.full_name}</h3>
                                            <small>@{user.username}</small>
                                        </div>
                                        <span className="pending-badge">
                                            PENDING APPROVAL
                                        </span>
                                    </div>
                                    
                                    <div className="user-card-body">
                                        <div className="user-details">
                                            <div className="detail-item">
                                                <span className="detail-label">Telegram ID:</span>
                                                <span className="detail-value">{user.telegram_user_id}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Role:</span>
                                                <span className="detail-value">{user.role}</span>
                                            </div>
                                            <div className="detail-item">
                                                <span className="detail-label">Registered:</span>
                                                <span className="detail-value">{formatDate(user.created_at)}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="user-actions">
                                            <button 
                                                className="btn-approve"
                                                onClick={() => handleApprove(user.id, user.full_name)}
                                            >
                                                ✓ Approve User
                                            </button>
                                            <button 
                                                className="btn-reject-user"
                                                onClick={() => handleReject(user.id, user.full_name)}
                                            >
                                                ✗ Reject User
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* ✅ 7. Render Toast Container */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}

export default UserManagement;