import axios from 'axios';

const api = axios.create({
    baseURL: 'http://192.168.100.72:8080/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

export default api;