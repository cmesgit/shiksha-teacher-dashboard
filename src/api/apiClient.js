/**
 * student_dashboard/src/api/apiClient.js  (REPLACEMENT)
 *
 * Cookie-based axios client — replaces the old localStorage bearer-token version.
 * Handles 401 → refresh → retry automatically. Same cookie domain as the
 * marketplace and teacher dashboard so all three apps share one session.
 *
 * The refresh itself is NOT owned here any more. It used to be: this module
 * kept its own `isRefreshing` flag and `failedQueue`, as did shared/apiClient.js
 * and AuthContext, so three "single"-flights raced each other against a backend
 * that rotates AND blacklists the refresh token — the losers were logged out of
 * a valid session. See shared/src/api/refreshSession.js for the full write-up.
 *
 * Retiring the local queue also fixes a second bug it had: requests released
 * from `failedQueue` were retried WITHOUT `_retry` set, so a token rejected
 * again immediately after a refresh could kick off a whole second refresh
 * round. Every retry below now carries the flag.
 */
import axios from "axios";
import { API_URL } from "../config/urls";
import { refreshSession, redirectToLogin } from "./refreshSession";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

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
    originalRequest._retry = true;
    try {
      await refreshSession();
      return api(originalRequest);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
