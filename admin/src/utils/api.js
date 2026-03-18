import { API_BASE } from '../config/api';

// Utility for making authenticated API calls
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('ag_admin_token');
  
  const authOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, authOptions);
    
    // Handle authentication errors
    if (response.status === 401) {
      console.warn('API returned 401 Unauthorized. Live backend may be rejecting the local dev token.');
      return null;
    }
    
    return response;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Utility for making authenticated GET requests
export const getWithAuth = async (url, options = {}) => {
  return fetchWithAuth(url, { method: 'GET', ...options });
};

// Utility for making authenticated POST requests
export const postWithAuth = async (url, data, options = {}) => {
  return fetchWithAuth(url, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });
};

// Utility for making authenticated PUT requests
export const putWithAuth = async (url, data, options = {}) => {
  return fetchWithAuth(url, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  });
};

// Utility for making authenticated DELETE requests
export const deleteWithAuth = async (url, options = {}) => {
  return fetchWithAuth(url, { method: 'DELETE', ...options });
};
