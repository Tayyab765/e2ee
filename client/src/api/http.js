import axios from 'axios';

export function api(token) {
  const instance = axios.create({ baseURL: import.meta.env.VITE_API_URL });
  if (token) {
    instance.interceptors.request.use((cfg) => {
      cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
  }
  return instance;
}
