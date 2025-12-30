// API Base URL - uses environment variable in production, localhost in development
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
