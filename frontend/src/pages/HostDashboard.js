import React, { useState, useMemo } from 'react';
import {
    useMyReportsQuery,
    useAvailableMonthsQuery
} from '../hooks/useReports';
import { formatCurrency, formatDateTime } from '../utils/format';
import './HostDashboard.css';

function HostDashboard() {
    const [filter, setFilter] = useState('ALL');
    
    // Month filter
    const [selectedMonth, setSelectedMonth] = useState('current');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const { data: availableMonths = [], isLoading: loadingMonths, error: monthsError } = useAvailableMonthsQuery();
    const { data: reportsData, isLoading: loadingReports, error: reportsError } = useMyReportsQuery(filter, selectedMonth, selectedYear);
    const reports = useMemo(() => reportsData?.reports || [], [reportsData]);

    // Calculate total live hours from duration strings
    const calculateTotalLiveHours = () => {
        let totalMinutes = 0;
        
        reports.forEach(report => {
            if (report.live_duration && report.status === 'VERIFIED') {
                const duration = report.live_duration;
                
                // Extract hours
                const hoursMatch = duration.match(/(\d+)\s*jam/);
                if (hoursMatch) {
                    totalMinutes += parseInt(hoursMatch[1]) * 60;
                }
                
                // Extract minutes
                const minutesMatch = duration.match(/(\d+)\s*menit/);
                if (minutesMatch) {
                    totalMinutes += parseInt(minutesMatch[1]);
                }
            }
        });
        
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        if (hours === 0 && minutes === 0) return '0 jam';
        if (hours === 0) return `${minutes} menit`;
        if (minutes === 0) return `${hours} jam`;
        return `${hours} jam ${minutes} menit`;
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

    const totalLiveHours = calculateTotalLiveHours();

    const stats = useMemo(() => ({
        total: reports.length,
        pending: reports.filter(r => r.status === 'PENDING').length,
        verified: reports.filter(r => r.status === 'VERIFIED').length,
        rejected: reports.filter(r => r.status === 'REJECTED').length,
        totalGMV: reports
            .filter(r => r.status === 'VERIFIED')
            .reduce((sum, r) => sum + parseFloat(r.reported_gmv), 0),
        totalLiveHours
    }), [reports, totalLiveHours]);

    return (
        <div className="dashboard">            
            <div className="dashboard-container">
                <h1>Host Dashboard</h1>
                <p>Your live session reports</p>

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

                {/* Statistics Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-info">
                            <h3>{stats.total}</h3>
                            <p>Total Reports</p>
                        </div>
                    </div>

                    <div className="stat-card pending">
                        <div className="stat-info">
                            <h3>{stats.pending}</h3>
                            <p>Pending</p>
                        </div>
                    </div>

                    <div className="stat-card verified">
                        <div className="stat-info">
                            <h3>{stats.verified}</h3>
                            <p>Verified</p>
                        </div>
                    </div>

                    <div className="stat-card rejected">
                        <div className="stat-info">
                            <h3>{stats.rejected}</h3>
                            <p>Rejected</p>
                        </div>
                    </div>

                    <div className="stat-card total-gmv">
                        <div className="stat-info">
                            <h3>{formatCurrency(stats.totalGMV)}</h3>
                            <p>Total GMV</p>
                        </div>
                    </div>

                    <div className="stat-card total-hours">
                        <div className="stat-info">
                            <h3>⏱️ {stats.totalLiveHours}</h3>
                            <p>Total Live Hours</p>
                        </div>
                    </div>
                </div>

                <div className="filter-section">
                    <h2>Report List</h2>
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
                </div>

                {(loadingReports || loadingMonths) ? (
                    <div className="loading">Loading reports...</div>
                ) : (
                    <div className="reports-list">
                        {reports.length === 0 ? (
                            <div className="empty-state">
                                {reportsError || monthsError ? (
                                    <p>Failed to load data</p>
                                ) : (
                                    <>
                                        <p>No reports yet</p>
                                        <small>Submit your GMV screenshot via Telegram Bot</small>
                                    </>
                                )}
                            </div>
                        ) : (
                            reports.map(report => (
                                <div key={report.id} className={`report-card ${report.status.toLowerCase()}`}>
                                    <div className="report-header">
                                        <div>
                                            <h3>Report #{report.id}</h3>
                                            <p className="report-date">{formatDateTime(report.created_at)}</p>
                                        </div>
                                        <span className={`status-badge ${report.status.toLowerCase()}`}>
                                            {report.status}
                                        </span>
                                    </div>
                                    
                                    <div className="report-body">
                                        <div className="report-info">
                                            <div className="info-item">
                                                <span className="info-label">GMV:</span>
                                                <span className="info-value">{formatCurrency(report.reported_gmv)}</span>
                                            </div>
                                            
                                            <div className="info-item">
                                                <span className="info-label">Durasi:</span>
                                                <span className="info-value" style={{
                                                    color: report.live_duration ? '#e67e22' : '#95a5a6',
                                                    fontWeight: report.live_duration ? '600' : 'normal'
                                                }}>
                                                    {report.live_duration || 'Tidak terdeteksi'}
                                                </span>
                                            </div>
                                            
                                            {report.notes && (
                                                <div className="info-item">
                                                    <span className="info-label">Notes:</span>
                                                    <span className="info-value">{report.notes}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* ❌ REMOVED: View Screenshot button */}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default HostDashboard;