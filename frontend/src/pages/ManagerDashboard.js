import React, { useState, useMemo } from 'react';
import {
    useAvailableMonthsQuery,
    useAllReportsQuery,
    useReportStatisticsQuery,
    useHostStatisticsQuery,
    useUpdateReportStatusMutation,
    getErrorMessage
} from '../hooks/useReports';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../utils/useToast';
import { formatCurrency, formatDateTime, formatHours } from '../utils/format';
import ToastContainer from '../components/ToastContainer';
import './ManagerDashboard.css';

function ManagerDashboard() {
    const [filter, setFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('current');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const { toasts, showToast, removeToast } = useToast();
    const queryClient = useQueryClient();

    const {
        data: availableMonths = [],
        isLoading: loadingMonths,
        error: monthsError
    } = useAvailableMonthsQuery();

    const {
        data: reportsData,
        isLoading: loadingReports,
        error: reportsError
    } = useAllReportsQuery(filter, selectedMonth, selectedYear, page, pageSize);

    const {
        data: statistics,
        isLoading: loadingStats,
        error: statsError
    } = useReportStatisticsQuery(selectedMonth, selectedYear);

    const {
        data: hostStats = [],
        isLoading: loadingHostStats,
        error: hostStatsError
    } = useHostStatisticsQuery(selectedMonth, selectedYear);

    const { mutateAsync: updateStatus } = useUpdateReportStatusMutation();

    const handleUpdateStatus = async (reportId, newStatus) => {
        try {
            await updateStatus({ id: reportId, status: newStatus, notes: '' });
            showToast(
                `Report ${newStatus === 'VERIFIED' ? 'verified' : 'rejected'} successfully!`, 
                'success'
            );
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Failed to update report status', 'error');
        }
    };

    const getMonthDisplay = () => {
        if (selectedMonth === 'all') return 'All Time';
        if (selectedMonth === 'current') {
            const now = new Date();
            return now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        }
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${monthNames[selectedMonth - 1]} ${selectedYear}`;
    };

    const reports = useMemo(() => reportsData?.reports || [], [reportsData]);
    const pagination = useMemo(
        () => reportsData?.pagination || { page: 1, totalPages: 1, total: (reportsData?.reports || []).length },
        [reportsData]
    );

    const filteredReports = useMemo(() => reports.filter(report => {
        const searchLower = searchTerm.toLowerCase();
        return (
            report.host_full_name.toLowerCase().includes(searchLower) ||
            report.host_username.toLowerCase().includes(searchLower)
        );
    }), [reports, searchTerm]);

    const loadingAny = loadingReports || loadingMonths || loadingStats || loadingHostStats;
    const hasError = reportsError || monthsError || statsError || hostStatsError;
    const errorMessage = hasError ? getErrorMessage(reportsError || monthsError || statsError || hostStatsError) : null;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['reports'] });
        queryClient.invalidateQueries({ queryKey: ['reports', 'statistics'] });
        queryClient.invalidateQueries({ queryKey: ['reports', 'hostStats'] });
        queryClient.invalidateQueries({ queryKey: ['reports', 'availableMonths'] });
    };

    const handlePageChange = (nextPage) => {
        if (nextPage < 1 || nextPage > (pagination.totalPages || 1)) return;
        setPage(nextPage);
    };

    const renderStatsSkeleton = () => (
        <div className="stats-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="stat-card">
                    <div className="stat-info">
                        <div className="skeleton skeleton-number" />
                        <div className="skeleton skeleton-text short" />
                    </div>
                </div>
            ))}
        </div>
    );

    const renderTableSkeleton = () => (
        <div className="table-container">
            <table className="reports-table">
                <thead>
                    <tr>
                        <th>ID</th><th>Host</th><th>GMV</th><th>Durasi</th><th>Status</th><th>Date</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={idx}>
                            {Array.from({ length: 7 }).map((__, i2) => (
                                <td key={i2}><div className="skeleton skeleton-text" /></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderHostSkeleton = () => (
        <div className="host-analytics">
            <h3>Host Performance - {getMonthDisplay()}</h3>
            <div className="host-list">
                {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="host-item-extended">
                        <div className="host-name-section">
                            <div className="skeleton skeleton-text" style={{ width: '140px' }} />
                            <div className="skeleton skeleton-text short" style={{ width: '90px' }} />
                        </div>
                        {Array.from({ length: 4 }).map((__, i2) => (
                            <div key={i2} className="host-stat">
                                <span className="skeleton skeleton-text short" style={{ width: '80px' }} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );

    // reset page when filter or month changes
    React.useEffect(() => {
        setPage(1);
    }, [filter, selectedMonth, selectedYear]);

    return (
        <div className="dashboard">            
            <div className="dashboard-container">
                <h1>Manager Dashboard</h1>
                <p>Manage and review live session reports</p>

                {/* Month Filter */}
                <div className="month-filter-section">
                    <div className="month-filter-label">
                        <strong>📅 Period:</strong> {getMonthDisplay()}
                    </div>
                    <select 
                        className="month-filter-select"
                        value={selectedMonth}
                        onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            if (e.target.value !== 'current' && e.target.value !== 'all') {
                                const selected = availableMonths.find(m => m.month === parseInt(e.target.value));
                                if (selected) setSelectedYear(selected.year);
                            }
                        }}
                    >
                        <option value="current">Current Month</option>
                        <option value="all">All Time</option>
                        <optgroup label="History">
                            {availableMonths.map(month => (
                                <option key={`${month.year}-${month.month}`} value={month.month}>
                                    {month.display_name} ({month.report_count} reports)
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                {hasError && (
                    <div className="error-banner">
                        {errorMessage || 'Failed to load data'}
                    </div>
                )}

                {/* Statistics Cards */}
                {loadingStats ? (
                    renderStatsSkeleton()
                ) : statistics && !statsError ? (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-info">
                                <h3>{statistics.total_reports}</h3>
                                <p>Total Reports</p>
                            </div>
                        </div>

                        <div className="stat-card pending">
                            <div className="stat-info">
                                <h3>{statistics.pending_reports}</h3>
                                <p>Pending</p>
                            </div>
                        </div>

                        <div className="stat-card verified">
                            <div className="stat-info">
                                <h3>{statistics.verified_reports}</h3>
                                <p>Verified</p>
                            </div>
                        </div>

                        <div className="stat-card rejected">
                            <div className="stat-info">
                                <h3>{statistics.rejected_reports}</h3>
                                <p>Rejected</p>
                            </div>
                        </div>

                        <div className="stat-card total-gmv">
                            <div className="stat-info">
                                <h3>{formatCurrency(statistics.total_verified_gmv)}</h3>
                                <p>Total GMV</p>
                            </div>
                        </div>

                        <div className="stat-card avg-gmv">
                            <div className="stat-info">
                                <h3>{formatCurrency(statistics.avg_verified_gmv)}</h3>
                                <p>Average GMV</p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Host Performance Analytics with Live Hours */}
                {loadingHostStats ? (
                    renderHostSkeleton()
                ) : hostStats.length > 0 && !hostStatsError ? (
                    <div className="host-analytics">
                        <h3>Host Performance - {getMonthDisplay()}</h3>
                        <div className="host-list">
                            {hostStats.map(host => (
                                <div key={host.host_id} className="host-item-extended">
                                    <div className="host-name-section">
                                        <div className="host-name">{host.host_full_name}</div>
                                        <small style={{ color: '#95a5a6', fontSize: '12px' }}>
                                            @{host.host_username}
                                        </small>
                                    </div>
                                    <div className="host-stat">
                                        <span className="host-stat-label">Reports</span>
                                        <span className="host-stat-value">{host.total_reports}</span>
                                    </div>
                                    <div className="host-stat">
                                        <span className="host-stat-label">Verified</span>
                                        <span className="host-stat-value">{host.verified_reports}</span>
                                    </div>
                                    <div className="host-stat">
                                        <span className="host-stat-label">Total GMV</span>
                                        <span className="host-stat-value">{formatCurrency(host.total_gmv)}</span>
                                    </div>
                                    <div className="host-stat live-hours">
                                        <span className="host-stat-label">Live Hours</span>
                                        <span className="host-stat-value" style={{ color: '#656565ff' }}>
                                            {host.total_live_hours ? formatHours(parseFloat(host.total_live_hours)) : '0 jam'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* Reports Table */}
                <div className="filter-section">
                    <h2>Session Reports</h2>
                    <div className="filter-controls">
                        <div className="search-box">
                            <input
                                type="text"
                                placeholder="Search host name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-buttons">
                            <button 
                                className={filter === 'ALL' ? 'active' : ''} 
                                onClick={() => setFilter('ALL')}
                            >
                                All
                            </button>
                            <button 
                                className={filter === 'PENDING' ? 'active' : ''} 
                                onClick={() => setFilter('PENDING')}
                            >
                                Pending
                            </button>
                            <button 
                                className={filter === 'VERIFIED' ? 'active' : ''} 
                                onClick={() => setFilter('VERIFIED')}
                            >
                                Verified
                            </button>
                            <button 
                                className={filter === 'REJECTED' ? 'active' : ''} 
                                onClick={() => setFilter('REJECTED')}
                            >
                                Rejected
                            </button>
                        </div>
                        <button
                            className="filter-refresh"
                            onClick={handleRefresh}
                            style={{ marginLeft: '8px' }}
                        >
                            Refresh
                        </button>
                        <div className="pagination-inline">
                            <button
                                disabled={page <= 1}
                                onClick={() => handlePageChange(page - 1)}
                            >
                                ‹
                            </button>
                            <span>
                                {pagination.page || page}/{pagination.totalPages || 1}
                            </span>
                            <button
                                disabled={page >= (pagination.totalPages || 1)}
                                onClick={() => handlePageChange(page + 1)}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                </div>

                {loadingAny ? (
                    renderTableSkeleton()
                ) : (
                    <div className="table-container">
                        <table className="reports-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Host</th>
                                    <th>GMV</th>
                                    <th>Durasi</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center' }}>
                                            {hasError ? (errorMessage || 'Failed to load data') : (searchTerm ? 'No reports found' : 'No reports available')}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map(report => (
                                        <tr key={report.id}>
                                            <td>#{report.id}</td>
                                            <td>
                                                <div className="host-info">
                                                    <strong>{report.host_full_name}</strong>
                                                    <small>@{report.host_username}</small>
                                                </div>
                                            </td>
                                            <td><strong>{formatCurrency(report.reported_gmv)}</strong></td>
                                            <td>
                                                <span style={{ 
                                                    color: report.live_duration ? '#c5c2bfff' : '#95a5a6',
                                                    fontWeight: report.live_duration ? '500' : 'normal',
                                                    fontSize: '13px'
                                                }}>
                                                    {report.live_duration || 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${report.status.toLowerCase()}`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td>{formatDateTime(report.created_at)}</td>
                                            <td>
                                                {report.status === 'PENDING' ? (
                                                    <div className="action-buttons">
                                                        <button 
                                                            className="btn-verify"
                                                            onClick={() => handleUpdateStatus(report.id, 'VERIFIED')}
                                                        >
                                                            Verify
                                                        </button>
                                                        <button 
                                                            className="btn-reject"
                                                            onClick={() => handleUpdateStatus(report.id, 'REJECTED')}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#999' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
}

export default ManagerDashboard;