// API Base URL - uses environment variable for Railway backend
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api');
