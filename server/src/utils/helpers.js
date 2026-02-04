// Utility helper functions

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const formatResponse = (status, message, data = null) => {
  return {
    status,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const handleError = (error) => {
  console.error('Error:', error);
  return {
    status: 'error',
    message: error.message || 'An error occurred',
  };
};
