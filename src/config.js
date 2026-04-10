const API_BASE = import.meta.env.VITE_API_URL || '/api';
const ASSETS_BASE = import.meta.env.VITE_ASSETS_URL || '';

export const apiUrl = (path = '') => `${API_BASE}${path}`;
export const assetsUrl = (path = '') => `${ASSETS_BASE}${path}`;

export default { apiUrl, assetsUrl };
