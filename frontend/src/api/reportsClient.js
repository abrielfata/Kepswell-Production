import api from './axios';

const reportsClient = {
    getAll: (params) => api.get('/reports', { params }),
    getStatistics: (params) => api.get('/reports/statistics', { params }),
    getMonthlyHostStatistics: (params) => api.get('/reports/monthly-host-stats', { params }),
    getAvailableMonths: () => api.get('/reports/available-months'),
    getMine: (params) => api.get('/reports/my-reports', { params }),
    getById: (id) => api.get(`/reports/${id}`),
    updateStatus: (id, status, notes) => api.put(`/reports/${id}/status`, { status, notes }),
};

export default reportsClient;

