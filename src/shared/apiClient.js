/* shared/apiClient.js — the ONE http client for all three apps.
 * Cookie-based auth (withCredentials), single-flight 401→refresh→retry.
 * Replaces both the marketplace's contexts/http.js (localStorage bearer) and
 * the duplicated per-app apiClients. Set VITE_API_URL per droplet.
 */
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://api.shikshacom.com/api",
  withCredentials: true,
});

let isRefreshing = false;
let queue = [];
const flush = (err) => { queue.forEach((p) => (err ? p.reject(err) : p.resolve())); queue = []; };

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";
    if (status !== 401 || original._retry ||
        url.includes("/accounts/refresh/") || url.includes("/accounts/login/")) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject })).then(() => api(original));
    }
    original._retry = true;
    isRefreshing = true;
    try {
      await api.post("/accounts/refresh/");
      flush(null);
      return api(original);
    } catch (e) {
      flush(e);
      const home = import.meta.env.VITE_HOME_URL || "https://www.shikshacom.com";
      window.location.href = home + "/login";
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
