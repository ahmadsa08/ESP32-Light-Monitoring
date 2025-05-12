# 📘 Project Documentation: Light Forecasting System

## Overview
This Google Apps Script project connects with an IoT sensor (e.g., light sensor) to:
- Log incoming readings to a Google Sheet.
- Generate and visualize forecasts (24 hours into the future).
- Use both EMA and Holt-Winters forecasting algorithms.

---

## 🔌 API Endpoints

### `GET` Request
**Purpose:** Test if the script is running.
```http
GET /exec
Response: "✅ Google Apps Script is reachable!"
