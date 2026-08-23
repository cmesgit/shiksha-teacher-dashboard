/* shared/apiClient.js  ·  UPDATED — imports from config/urls.js
 * ──────────────────────────────────────────────────────────────
 * Cookie-based auth, 401→refresh→retry.
 * URL fallback now comes from config/urls.js — no more inline prod strings.
 *
 * The single-flight moved out of this file into shared/src/api/refreshSession.js:
 * it was module-local, and so were the copies in api/apiClient.js and
 * AuthContext, so all three raced the same refresh cookie against a
 * rotate-and-blacklist backend and logged users out of valid sessions. The
 * refresh is now shared tab-wide; read that file's header before changing any
 * of this.
 */
import axios from "axios";
import { API_URL } from "../config/urls";
import { refreshSession, redirectToLogin } from "../api/refreshSession";

const api = axios.create({
  baseURL:         API_URL,
  withCredentials: true,
});

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
    original._retry = true;
    try {
      await refreshSession();
      return api(original);
    } catch (e) {
      redirectToLogin();
      return Promise.reject(e);
    }
  }
);

export default api;
