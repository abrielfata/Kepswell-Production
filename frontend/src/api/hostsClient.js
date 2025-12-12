import api from './axios';

const hostsClient = {
    getAll: (params) => api.get('/hosts', { params }),
    getById: (id) => api.get(`/hosts/${id}`),
    create: (data) => api.post('/hosts', data),
    update: (id, data) => api.put(`/hosts/${id}`, data),
    delete: (id) => api.delete(`/hosts/${id}`),
    toggleStatus: (id) => api.patch(`/hosts/${id}/toggle-status`),
};

export default hostsClient;

