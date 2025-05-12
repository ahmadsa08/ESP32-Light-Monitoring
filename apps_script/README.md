# 📊 Light Intensity Forecasting System (Google Apps Script)

A Google Apps Script project that logs light sensor data and generates 24-hour forecasts using both **Exponential Moving Average (EMA)** and **Holt-Winters** methods. It stores and visualizes data directly in Google Sheets with charts and confidence intervals.

## 🚀 Features
- ✅ Logs light intensity via POST request
- ✅ Supports GET requests for API testing
- ✅ EMA & Holt-Winters forecasting (24-hour)
- ✅ Upper/Lower confidence bounds
- ✅ Interactive line chart
- ✅ Menu options in Google Sheets UI
- ✅ Data clearing function

## 📦 Files
- `forecast.gs` — Main script for handling forecasts, data logging, and UI.
- `README.md` — Project overview and usage.
- `documentation.md` — Detailed technical documentation.
- `LICENSE` — MIT License.

## 🛠️ How to Use
1. **Install** the Google Apps Script in your Google Sheet:
   - Open Google Sheets > Extensions > Apps Script.
   - Paste `forecast.gs` content.
2. **Deploy Web App:**
   - Deploy > New Deployment > Select `Web App`.
   - Set access to **Anyone** or **Anyone with the link**.
3. **Send Sensor Data:**
   - Send a POST request with a JSON payload:
     ```json
     {
       "light": 123.45
     }
     ```
   - Endpoint: `https://script.google.com/macros/s/your-deployment-id/exec`
4. **Use Forecast Menu:**
   - Inside the Google Sheet, use the **Sensor Data** menu to:
     - Generate EMA + Holt-Winters Forecasts
     - Clear previous forecast data

## 📈 Forecast Chart
A chart is auto-generated to compare current data with both EMA and Holt-Winters forecasts and their upper/lower bounds.

## 📋 License
See [LICENSE](./LICENSE).

---
