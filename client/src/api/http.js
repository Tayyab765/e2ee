import axios from 'axios';

export function api(token) {
  const instance = axios.create({ baseURL: '/api' });
  if (token) {
    instance.interceptors.request.use((cfg) => {
      cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
  }
  return instance;
}
