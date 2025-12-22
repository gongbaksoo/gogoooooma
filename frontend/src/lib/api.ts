import axios from "axios";
import { API_BASE_URL } from "@/config/api";

// Switch to 127.0.0.1 to avoid IPv6 resolution overhead which can cause timeouts on some systems
const BASE_URL = API_BASE_URL.replace('localhost', '127.0.0.1');

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000, // Increased to 30 seconds to handle initial cold starts or heavy processing
});

export const getLogs = async () => {
    const response = await api.get(`/logs/?t=${Date.now()}`);
    return response.data;
};

export const getApiKeyStatus = async () => {
    const response = await api.get(`/admin/api-key-status?t=${Date.now()}`);
    return response.data;
};

export async function saveApiKey(apiKey: string) {
    return api.post("/save-api-key/", { api_key: apiKey });
}

export async function getFileList() {
    const response = await api.get(`/files/?t=${Date.now()}`);
    return response.data;
}

export async function deleteFile(filename: string) {
    await api.delete(`/files/${filename}`);
}

export default api;
