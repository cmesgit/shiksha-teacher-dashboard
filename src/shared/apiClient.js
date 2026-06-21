/* shared/apiClient.js  ·  UPDATED — imports from config/urls.js
 * ──────────────────────────────────────────────────────────────
 * Cookie-based auth, single-flight 401→refresh→retry.
 * URL fallback now comes from config/urls.js — no more inline prod strings.
 */
import axios from "axios";
import { API_URL, LOGIN_URL } from "../config/urls";

const api = axios.create({
  baseURL:         API_URL,
  withCredentials: true,
});

let isRefreshing = false;
let queue = [];
const flush = (err) => { queue.forEach((p) => (err ? p.reject(err) : p.resolve())); queue = []; };

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status   = error.response?.status;
    const url      = original?.url || "";
    if (
      status !== 401 || original._retry ||
      url.includes("/accounts/refresh/") || url.includes("/accounts/login/")
    ) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) =>
        queue.push({ resolve, reject })
      ).then(() => api(original));
    }
    original._retry = true;
    isRefreshing    = true;
    try {
      await api.post("/accounts/refresh/");
      flush(null);
      return api(original);
    } catch (e) {
      flush(e);
      window.location.href = LOGIN_URL;
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
