import axios from 'axios';
import { message } from 'antd';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errorMessage = error.response?.data?.message || 'An error occurred';

    if (status === 401) {
      // Token expired or invalid
      localStorage.removeItem('smarterp-auth');
      window.location.href = '/login';
    } else if (status === 403) {
      message.error('You do not have permission to perform this action');
    } else if (status === 404) {
      message.error('Resource not found');
    } else if (status === 409) {
      message.error(errorMessage);
    } else if (status === 422 || status === 400) {
      if (Array.isArray(errorMessage)) {
        errorMessage.forEach((msg: string) => message.error(msg));
      } else {
        message.error(errorMessage);
      }
    } else if (status >= 500) {
      message.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  },
);

// Helper functions
export const fetcher = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const { data } = await api.get<T>(url, { params });
  return data;
};

export const formatCurrency = (amount: number, currency = 'THB', locale = 'th-TH') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatNumber = (num: number, locale = 'th-TH') => {
  return new Intl.NumberFormat(locale).format(num);
};

export const formatDate = (date: string | Date, locale = 'th-TH') => {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: string | Date, locale = 'th-TH') => {
  return new Date(date).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
