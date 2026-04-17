import axios from 'axios';

const getApiBaseUrl = () => {
    const fromEnv = process.env.REACT_APP_API_BASE_URL;
    if (fromEnv) {
        return fromEnv;
    }

    if (process.env.NODE_ENV === 'production') {
        console.error('Missing REACT_APP_API_BASE_URL in production build');
        return '/api';
    }

    return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    // Login with email and password
    login: (email, password) => {
        return api.post('/auth/login', { email, password });
    },
    getCurrentUser: () => {
        return api.get('/auth/me');
    }
};

// Reports API - UPDATED
export const reportsAPI = {
    getAllReports: (params) => {
        return api.get('/reports', { params });
    },
    getStatistics: (params) => {
        return api.get('/reports/statistics', { params }); // Now accepts month/year
    },
    getMonthlyHostStatistics: (params) => {
        return api.get('/reports/monthly-host-stats', { params }); // NEW
    },
    getAvailableMonths: () => {
        return api.get('/reports/available-months'); // NEW
    },
    getMyReports: (params) => {
        return api.get('/reports/my-reports', { params });
    },
    getReportById: (id) => {
        return api.get(`/reports/${id}`);
    },
    updateReportStatus: (id, status, notes) => {
        return api.put(`/reports/${id}/status`, { status, notes });
    }
};

// Users API
export const usersAPI = {
    getPendingUsers: () => {
        return api.get('/users/pending');
    },
    approveUser: (userId) => {
        return api.put(`/users/${userId}/approve`);
    },
    rejectUser: (userId) => {
        return api.delete(`/users/${userId}/reject`);
    }
};

// Hosts API
export const hostsAPI = {
    getAllHosts: (params) => {
        return api.get('/hosts', { params });
    },
    getHostById: (id) => {
        return api.get(`/hosts/${id}`);
    },
    createHost: (hostData) => {
        return api.post('/hosts', hostData);
    },
    updateHost: (id, hostData) => {
        return api.put(`/hosts/${id}`, hostData);
    },
    deleteHost: (id) => {
        return api.delete(`/hosts/${id}`);
    },
    toggleHostStatus: (id) => {
        return api.patch(`/hosts/${id}/toggle-status`);
    }
};

export default api;