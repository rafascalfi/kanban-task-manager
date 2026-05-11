import axios from 'axios';

const api = axios.create({
  // Em desenvolvimento o Vite faz o proxy. Em produção no Vercel, o caminho é relativo.
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
