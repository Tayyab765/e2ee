import axios from 'axios';

export function api(token) {
  const instance = axios.create({ baseURL: 'https://localhost:4000/api' });
  if (token) {
    instance.interceptors.request.use((cfg) => {
      cfg.headers.Authorization = `Bearer ${token}`;
      return cfg;
    });
  }
  return instance;
}
