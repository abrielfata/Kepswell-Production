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

const api = axios.create({
    baseURL: getApiBaseUrl(),
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;

