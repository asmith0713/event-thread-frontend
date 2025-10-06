import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Auth API - matches your backend auth.js
export const authAPI = {
  login: (username, password, isAdmin) =>
    api.post('/auth/login', { username, password, isAdmin }),
};

// Threads API - matches your backend threads.js
export const threadsAPI = {
  getAll: () => api.get('/threads'),
  create: (data) => api.post('/threads', {
    title: data.title,
    description: data.description,
    creator: data.createdByName,
    creatorId: data.createdBy,
    location: data.location,
    tags: data.tags || [],
    expiresAt: data.expiresAt
  }),
  delete: (id, userId) => api.delete(`/threads/${id}`, { data: { userId } }),
  requestJoin: (id, userId) => api.post(`/threads/${id}/join`, { userId }),
  handleRequest: (id, userId, approve, currentUserId) =>
    api.post(`/threads/${id}/requests`, { userId, approve, currentUserId }),
  sendMessage: (id, data) => api.post(`/threads/${id}/messages`, {
    user: data.username,
    userId: data.userId,
    message: data.content
  }),
  update: (id, data) => api.put(`/threads/${id}`, data),
};

// Admin API - matches your backend admin.js
export const adminAPI = {
  getDashboard: (userId) => api.get(`/admin/dashboard?userId=${userId}`),
};

export default api;
