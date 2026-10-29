import axios from "axios";

import { Platform } from "react-native";

const API_URL = Platform.select({
  android: "https://installment-manager-api.onrender.com/api",
  ios: "https://installment-manager-api.onrender.com/api",
  default: "https://installment-manager-api.onrender.com/api",
});

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
