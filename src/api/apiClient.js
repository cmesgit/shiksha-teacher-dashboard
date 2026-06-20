/**
 * student_dashboard/src/api/apiClient.js  (REPLACEMENT)
 *
 * Cookie-based axios client — replaces the old localStorage bearer-token version.
 * Handles 401 → refresh → retry automatically. Same cookie domain as the
 * marketplace and teacher dashboard so all three apps share one session.
 */
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api",
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => { error ? prom.reject(error) : prom.resolve(); });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/accounts/refresh/") ||
      originalRequest.url?.includes("/accounts/login/")
    ) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); })
        .then(() => api(originalRequest));
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api"}/accounts/refresh/`,
        {}, { withCredentials: true }
      );
      processQueue(null);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      window.location.href = (import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com") + "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
