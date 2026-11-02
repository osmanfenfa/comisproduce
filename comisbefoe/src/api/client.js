import axios from "axios";
import { useAuthStore } from "../store/authStore.js";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
client.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized/expired, log out immediately
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default client;
