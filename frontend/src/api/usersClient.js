import api from './axios';

const usersClient = {
    getPending: () => api.get('/users/pending'),
    approve: (userId) => api.put(`/users/${userId}/approve`),
    reject: (userId) => api.delete(`/users/${userId}/reject`),
};

export default usersClient;

