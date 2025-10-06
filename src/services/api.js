import axios from 'axios';

// 🔧 FIXED: Remove /api from fallback URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

console.log('🔗 Using API_URL:', API_URL);

const DEFAULT_TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestWithRetry(requestFn, options = {}) {
  const { retries = 2, baseDelayMs = 800 } = options;
  let attempt = 0;
  // Exponential backoff with jitter to survive cold starts
  while (true) {
    try {
      return await requestFn();
    } catch (error) {
      const status = error.response?.status;
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout');
      const isNetwork = !error.response;
      const isRetriableStatus = status >= 500 && status < 600;

      const shouldRetry = attempt < retries && (isTimeout || isNetwork || isRetriableStatus);
      if (!shouldRetry) throw error;

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), 4000) + Math.floor(Math.random() * 200);
      console.warn(`🔁 Retry attempt ${attempt + 1} after ${delay}ms due to`, {
        status,
        code: error.code,
        url: error.config?.url,
      });
      await sleep(delay);
      attempt += 1;
    }
  }
}

const api = axios.create({
  // 🔧 FIXED: Use backticks for template literal
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
});

// Request interceptor
api.interceptors.request.use((config) => {
  // 🔧 FIXED: Use 'authToken' to match your LoginForm
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add debugging
  console.log('📡 API Request:', config.method?.toUpperCase(), config.url);
  console.log('📡 Full URL:', `${config.baseURL}${config.url}`);
  
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Success:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.response?.status, error.config?.url);
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Auth API - with register route added
export const authAPI = {
  login: (username, password, isAdmin) =>
    requestWithRetry(() => api.post('/auth/login', { username, password, isAdmin })),
    
  // 🔧 ADDED: Missing register route
  register: (username, password) =>
    requestWithRetry(() => api.post('/auth/register', { username, password })),
};

// Your existing threadsAPI and adminAPI (unchanged)
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

export const adminAPI = {
  getDashboard: (userId) => api.get(`/admin/dashboard?userId=${userId}`),
};

export default api;
