import axios from "axios";

const api = axios.create({
    baseURL: "/api",
});

export const getLogs = async () => {
    const response = await api.get("/logs/");
    return response.data;
};

export const getApiKeyStatus = async () => {
    const response = await api.get("/admin/api-key-status");
    return response.data;
};

export async function saveApiKey(apiKey: string) {
    return api.post("/save-api-key/", { api_key: apiKey });
}

export async function getFileList() {
    const response = await api.get("/files/");
    return response.data;
}

export async function deleteFile(filename: string) {
    await api.delete(`/files/${filename}`);
}

export default api;
