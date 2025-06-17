// === CONFIGURATION ===
// Set to true to use a specific custom start date for forecasting,
// otherwise, the forecast will start after the last recorded timestamp.
var OVERRIDE_FORECAST_START_DATE = true;
// Define the custom start date for the forecast.
var CUSTOM_FORECAST_START_DATE = new Date('2025-04-15T00:00:00');

// IMPORTANT: Retrieve your Gemini API Key from Script Properties.
// To set this up:
// 1. Go to Project Settings (gear icon) in your Apps Script project.
// 2. Navigate to 'Script Properties'.
// 3. Click 'Add script property'.
// 4. Set 'Property' to `GEMINI_API_KEY` and 'Value' to your actual Gemini API key.
// This ensures your API key is not hardcoded in the script directly.
var GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

// Log to confirm API key retrieval (for debugging purposes).
// Only logs the first 5 characters to prevent accidental full key exposure in logs.
Logger.log("Retrieved API Key (first 5 chars): " + (GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 5) + "..." : "NULL/UNDEFINED"));

// --- Web App Endpoints ---

/**
 * Handles GET requests to the deployed Google Apps Script web app.
 * This is a simple endpoint to confirm the script is reachable.
 * @param {GoogleAppsScript.Events.DoGet} e - The event object.
 * @returns {GoogleAppsScript.Content.TextOutput} A text output confirming reachability.
 */
function doGet(e) {
  return ContentService.createTextOutput("✅ Google Apps Script is reachable!");
}

/**
 * Handles POST requests to the deployed Google Apps Script web app.
 * Expects a JSON payload with a 'light' property.
 * Appends the current timestamp and the 'light' value to "Sheet1".
 * @param {GoogleAppsScript.Events.DoPost} e - The event object containing POST data.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSON response indicating success or error.
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
    // Parse the incoming JSON data from the POST request body.
    var data = JSON.parse(e.postData.contents);
    var light = data.light;
    // Append the current date/time and the received light intensity to the sheet.
    sheet.appendRow([new Date(), light]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data logged successfully" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Return an error message if anything goes wrong during data processing.
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Spreadsheet UI Functions ---

/**
 * Creates a custom menu in the Google Sheet UI when the spreadsheet is opened.
 * This provides easy access to the script's main functionalities.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sensor Data')
    .addItem('Run Full Forecast + AI Summary', 'runFullForecastPipeline')
    .addItem('Generate Forecasts (EMA & Holt-Winters)', 'generateCombinedForecasts')
    .addItem('Summarize Forecast', 'summarizeForecastWithAI')
    .addToUi();
}

/**
 * Clears data from the "Forecasts" sheet.
 * If the "Forecasts" sheet does not exist, it creates it.
 */
function clearData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var forecastSheet = ss.getSheetByName("Forecasts");
  if (!forecastSheet) forecastSheet = ss.insertSheet("Forecasts");
  else forecastSheet.clear(); // Clears all content from the sheet.
  SpreadsheetApp.getUi().alert("Forecast data cleared.");
}

/**
 * Runs the complete forecasting pipeline, including generating forecasts
 * and then summarizing them with AI. This is a convenience function.
 */
function runFullForecastPipeline() {
  generateCombinedForecasts();
  summarizeForecastWithAI();
}

// --- Forecasting Functions ---

/**
 * Generates both Exponential Moving Average (EMA) and Holt-Winters forecasts.
 * It reads actual sensor data from "Sheet1", calculates in-sample and future forecasts,
 * writes results to the "Forecasts" sheet, creates a chart, and logs accuracy.
 */
function generateCombinedForecasts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sheet1"); // Source sheet for raw sensor data.
  var forecastSheet = ss.getSheetByName("Forecasts"); // Sheet to store forecast results.

  // Create "Forecasts" sheet if it doesn't exist, otherwise clear its contents.
  if (!forecastSheet) forecastSheet = ss.insertSheet("Forecasts");
  else forecastSheet.clear();

  // Check if "Sheet1" exists and has data.
  if (!sheet || sheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert("No data found in Sheet1. Please add sensor data first.");
    return;
  }

  // Get raw timestamp and light intensity values from "Sheet1".
  var rawValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var timestamps = [],
    sensorValues = [];

  // Parse and validate the data, ensuring timestamps are Date objects and values are numbers.
  for (var i = 0; i < rawValues.length; i++) {
    var ts = rawValues[i][0],
      val = rawValues[i][1];
    var parsedTs = (ts instanceof Date) ? ts : new Date(ts);
    if (!isNaN(parsedTs.getTime()) && typeof val === 'number') {
      timestamps.push(parsedTs);
      sensorValues.push(val);
    }
  }

  // Alert if no valid data is found after parsing.
  if (timestamps.length === 0) {
    SpreadsheetApp.getUi().alert("No valid timestamp or light intensity values found in Sheet1.");
    return;
  }

  // Add headers to the "Forecasts" sheet.
  forecastSheet.appendRow([
    "Timestamp", "Actual Light Intensity", "EMA Forecast (Historical)", "Holt-Winters Forecast (Historical)",
    "EMA Forecast (Future)", "EMA Forecast Upper", "EMA Forecast Lower",
    "HW Forecast (Future)", "HW Forecast Upper", "HW Forecast Lower"
  ]);

  // Calculate in-sample forecasts for historical data.
  var inSampleEma = getInSampleEMA(sensorValues, 0.1);
  var inSampleHW = getInSampleHoltWinters(sensorValues, 0.3, 0.1);

  // Write historical data and in-sample forecasts to the "Forecasts" sheet.
  for (var i = 0; i < timestamps.length; i++) {
    forecastSheet.appendRow([
      timestamps[i], sensorValues[i], inSampleEma[i], inSampleHW[i], null, null, null, null, null, null
    ]);
  }

  // Determine the forecast start time based on configuration.
  // If OVERRIDE_FORECAST_START_DATE is true, use CUSTOM_FORECAST_START_DATE.
  // Otherwise, start 1 hour after the last recorded actual timestamp.
  var forecastStartTime = (OVERRIDE_FORECAST_START_DATE && !isNaN(CUSTOM_FORECAST_START_DATE.getTime())) ?
    CUSTOM_FORECAST_START_DATE :
    new Date(timestamps[timestamps.length - 1].getTime() + 3600000); // Add 1 hour (3600000 ms)

  // Calculate future EMA and Holt-Winters forecasts.
  var emaFuture = calculateEMAForecasts(timestamps, sensorValues, forecastStartTime);
  var hwFuture = calculateHoltWintersForecasts(timestamps, sensorValues, forecastStartTime);

  // Write future forecasts to the "Forecasts" sheet.
  for (var i = 0; i < emaFuture.length; i++) {
    forecastSheet.appendRow([
      emaFuture[i].timestamp, null, null, null, // Actual and historical columns are left blank for future forecasts.
      emaFuture[i].forecastValue, emaFuture[i].upperBound, emaFuture[i].lowerBound,
      hwFuture[i].forecastValue, hwFuture[i].upperBound, hwFuture[i].lowerBound
    ]);
  }

  // Format the Timestamp column for better readability.
  forecastSheet.getRange("A:A").setNumberFormat("M/dd/yyyy h:mm:ss");
  // Create and insert a combined chart visualizing the forecasts.
  createCombinedChart(forecastSheet);
  // Log forecast accuracy to a separate sheet.
  logForecastAccuracy(timestamps, sensorValues, emaFuture, hwFuture);
}

/**
 * Calculates a single Exponential Moving Average (EMA) value for a given set of values.
 * @param {number[]} values - An array of numerical data points.
 * @param {number} alpha - The smoothing factor (between 0 and 1).
 * @returns {number} The final EMA value.
 */
function calculateEMA(values, alpha) {
  var ema = values[0]; // Initialize EMA with the first value.
  for (var i = 1; i < values.length; i++) {
    // EMA formula: current value * alpha + previous EMA * (1 - alpha)
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return ema;
}

/**
 * Calculates in-sample (historical) EMA forecasts for a series of values.
 * @param {number[]} values - An array of numerical data points.
 * @param {number} alpha - The smoothing factor (between 0 and 1).
 * @returns {number[]} An array of EMA forecasts, corresponding to each historical data point.
 */
function getInSampleEMA(values, alpha) {
  var forecasts = [values[0]]; // First forecast is the first actual value.
  var ema = values[0];
  for (var i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
    forecasts.push(ema);
  }
  return forecasts;
}

/**
 * Calculates future EMA forecasts for 24 periods (hours).
 * @param {Date[]} timestamps - Historical timestamps (not directly used for forecast value but for calculating start time if not overridden).
 * @param {number[]} values - Historical numerical data points.
 * @param {Date} forecastStartTime - The timestamp to start the future forecast from.
 * @returns {Object[]} An array of objects, each containing timestamp, forecastValue, upperBound, and lowerBound.
 */
function calculateEMAForecasts(timestamps, values, forecastStartTime) {
  var forecasts = [];
  // Calculate the last EMA based on all historical data.
  var ema = calculateEMA(values, 0.1); // Using a fixed alpha for future forecasts.
  // Generate forecasts for the next 24 periods (assuming hourly).
  for (var i = 0; i < 24; i++) {
    var ts = new Date(forecastStartTime.getTime() + i * 3600000); // Increment by 1 hour.
    // EMA forecasts for the future are constant if the model is simple (no trend/seasonality).
    // Upper and lower bounds are simple percentages (10% deviation).
    forecasts.push({
      timestamp: ts,
      forecastValue: ema,
      upperBound: ema * 1.1, // 10% above
      lowerBound: ema * 0.9 // 10% below
    });
  }
  return forecasts;
}

/**
 * Calculates in-sample (historical) Holt-Winters forecasts for a series of values (Additive Model).
 * This implementation assumes no seasonality and focuses on level and trend.
 * @param {number[]} values - An array of numerical data points.
 * @param {number} alpha - Smoothing factor for the level (0 to 1).
 * @param {number} beta - Smoothing factor for the trend (0 to 1).
 * @returns {number[]} An array of Holt-Winters forecasts, corresponding to each historical data point.
 */
function getInSampleHoltWinters(values, alpha, beta) {
  var forecasts = [];
  // Initialize level and trend. Requires at least two data points.
  var level = values[0],
    trend = values[1] - values[0];
  forecasts.push(level); // The first forecast is the initial level.

  for (var i = 1; i < values.length; i++) {
    var lastLevel = level;
    // Update level: alpha * current value + (1 - alpha) * (last level + last trend)
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    // Update trend: beta * (current level - last level) + (1 - beta) * last trend
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    // The forecast for the next period is the current level + current trend.
    forecasts.push(level + trend);
  }
  return forecasts;
}

/**
 * Calculates future Holt-Winters forecasts for up to 24 periods (hours).
 * This implementation assumes no seasonality and focuses on level and trend.
 * @param {Date[]} timestamps - Historical timestamps.
 * @param {number[]} values - Historical numerical data points.
 * @param {Date} forecastStartTime - The timestamp to start the future forecast from.
 * @returns {Object[]} An array of objects, each containing timestamp, forecastValue, upperBound, and lowerBound.
 */
function calculateHoltWintersForecasts(timestamps, values, forecastStartTime) {
  var forecasts = [];
  // If insufficient data for Holt-Winters, fall back to EMA.
  if (values.length < 3) return calculateEMAForecasts(timestamps, values, forecastStartTime);

  // Define smoothing factors.
  var alpha = 0.3,
    beta = 0.1;
  // Initialize level and trend using the first two data points.
  var level = values[0],
    trend = values[1] - values[0];

  // Update level and trend using all historical data to get the final state.
  for (var i = 1; i < values.length; i++) {
    var prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Generate forecasts for the next 24 periods.
  // The forecast for h periods ahead is level + h * trend.
  for (var i = 1; i <= 24; i++) {
    var ts = new Date(forecastStartTime.getTime() + (i - 1) * 3600000);
    var forecastVal = level + trend * i; // Forecast value based on final level and trend.
    // Upper and lower bounds are simple percentages (10% deviation).
    forecasts.push({
      timestamp: ts,
      forecastValue: forecastVal,
      upperBound: forecastVal * 1.1, // 10% above
      lowerBound: forecastVal * 0.9 // 10% below
    });
  }
  return forecasts;
}

/**
 * Creates and inserts a combined line chart into the "Forecasts" sheet.
 * The chart visualizes actual data, historical EMA, historical Holt-Winters,
 * and future forecasts for both EMA and Holt-Winters.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet where the chart will be inserted.
 */
function createCombinedChart(sheet) {
  var chartBuilder = sheet.newChart()
    .setChartType(Charts.ChartType.LINE) // Line chart type.
    // Add data ranges for actuals, historical EMA, historical HW, future EMA, and future HW.
    // Note: The range selection should be adjusted if column order changes.
    .addRange(sheet.getRange("A2:B" + sheet.getLastRow())) // Actual Light Intensity
    .addRange(sheet.getRange("A2:C" + sheet.getLastRow())) // EMA Forecast (Historical)
    .addRange(sheet.getRange("A2:D" + sheet.getLastRow())) // Holt-Winters Forecast (Historical)
    .addRange(sheet.getRange("A2:E" + sheet.getLastRow())) // EMA Forecast (Future)
    .addRange(sheet.getRange("A2:H" + sheet.getLastRow())) // HW Forecast (Future)
    // Set chart position (row, column, offset x, offset y).
    .setPosition(2, 12, 0, 0)
    .setOption("title", "Light Intensity Forecasts (EMA & Holt-Winters)"); // Chart title.
  sheet.insertChart(chartBuilder.build()); // Build and insert the chart.
}

/**
 * Logs forecast accuracy by comparing recent actual values with corresponding
 * future forecast values and storing them in a "ForecastHistory" sheet.
 * @param {Date[]} timestamps - Array of historical timestamps.
 * @param {number[]} actualValues - Array of actual sensor values.
 * @param {Object[]} emaForecasts - Array of future EMA forecast objects.
 * @param {Object[]} hwForecasts - Array of future Holt-Winters forecast objects.
 */
function logForecastAccuracy(timestamps, actualValues, emaForecasts, hwForecasts) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var historySheet = ss.getSheetByName("ForecastHistory");
  // Create "ForecastHistory" sheet if it doesn't exist and add headers.
  if (!historySheet) {
    historySheet = ss.insertSheet("ForecastHistory");
    historySheet.appendRow(["Timestamp", "Actual", "EMA Forecast", "HW Forecast", "EMA Error", "HW Error"]);
  }

  // Loop through recent actual values (up to the last 24, corresponding to future forecasts).
  for (var i = 0; i < Math.min(24, actualValues.length); i++) {
    // Calculate the index for the historical actual value that aligns with the forecast.
    var idx = timestamps.length - 24 + i;
    var ts = timestamps[idx]; // The timestamp of the actual value.
    var actual = actualValues[idx]; // The actual value.
    // Get the corresponding forecast values, using null if not available.
    var ema = emaForecasts[i]?.forecastValue ?? null;
    var hw = hwForecasts[i]?.forecastValue ?? null;
    // Calculate absolute errors.
    var emaError = ema !== null ? Math.abs(actual - ema) : "";
    var hwError = hw !== null ? Math.abs(actual - hw) : "";
    // Append the data to the history sheet.
    historySheet.appendRow([ts, actual, ema, hw, emaError, hwError]);
  }
}

// --- AI Summary Functions ---

/**
 * Summarizes the forecast data using the Gemini AI model.
 * It reads data from the "Forecasts" sheet, constructs a prompt,
 * sends it to Gemini, and then saves the summary to a "Summary" sheet.
 * Includes a fallback mechanism for API failures or quota limits.
 */
function summarizeForecastWithAI() {
  // Get the "Forecasts" sheet.
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Forecasts");
  const lastRow = sheet.getLastRow();
  // Get all data from column A (Timestamp) and B (Actual Light Intensity)
  // assuming these are the most relevant for a general summary.
  const data = sheet.getRange(`A2:B${lastRow}`).getValues();

  // Alert if no data is found in the "Forecasts" sheet.
  if (data.length === 0) {
    SpreadsheetApp.getUi().alert("No data in Forecasts sheet to summarize. Please generate forecasts first.");
    return;
  }

  // Format the data into a string for the AI prompt.
  const summaryInput = data.map(row => `Time: ${row[0]}, Light: ${row[1]}`).join('\n');
  Logger.log("Summary Input Length: " + summaryInput.length);
  Logger.log("Summary Input (first 500 chars):\n" + summaryInput.substring(0, Math.min(summaryInput.length, 500)));

  // Gemini API endpoint URL. Using gemini-1.5-pro model.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
  // Construct the payload for the API request.
  const payload = JSON.stringify({
    contents: [{
      parts: [{
        text: `Please provide a concise summary of these light forecast data points, highlighting key trends:\n${summaryInput}`
      }]
    }]
  });

  // Set request options for UrlFetchApp.
  const options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true // Prevents Apps Script from throwing an exception on HTTP errors (e.g., 429).
  };

  try {
    // Make the API call to Gemini.
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    Logger.log("Gemini API Response: " + JSON.stringify(result));

    // Check for rate limit error (429 Too Many Requests).
    if (result.error?.code === 429) {
      Logger.log("Gemini API quota exceeded. Using fallback summary.");
      fallbackSummary(data); // Call fallback function.
      SpreadsheetApp.getUi().alert("Gemini quota exceeded. A basic summary was generated instead.");
      return;
    }

    // Extract the summary text from the API response.
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";
    saveSummaryToSheet(summary); // Save the summary to a sheet.
    SpreadsheetApp.getUi().alert("Forecast summary generated using Gemini AI.");
  } catch (error) {
    // Catch any other errors during the API call or processing.
    Logger.log("Error calling Gemini API: " + error.toString());
    fallbackSummary(data); // Call fallback function.
    SpreadsheetApp.getUi().alert("Gemini API failed. A basic summary was generated instead.");
  }
}

/**
 * Provides a basic summary of the forecast data if the AI summary fails or is unavailable.
 * Calculates min, max, average, and a simple trend.
 * @param {Array<Array<Date|number>>} data - The raw forecast data (timestamps and light values).
 */
function fallbackSummary(data) {
  // Filter for valid numerical light values.
  const lightValues = data.map(row => row[1]).filter(v => typeof v === 'number');
  if (lightValues.length === 0) return; // Exit if no valid light values.

  // Calculate basic statistics.
  const min = Math.min(...lightValues);
  const max = Math.max(...lightValues);
  const avg = lightValues.reduce((sum, v) => sum + v, 0) / lightValues.length;
  // Determine a simple trend based on the first and last values.
  const trend = lightValues[lightValues.length - 1] > lightValues[0] ? "increasing" : "decreasing";

  // Construct the fallback summary text.
  const summaryText = `The basic forecast summary includes ${lightValues.length} data points. The minimum light intensity recorded is ${min}, while the maximum is ${max}. The average light intensity is ${avg.toFixed(2)}. Overall, the trend is ${trend}.`;

  saveSummaryToSheet(summaryText); // Save the fallback summary.
}

/**
 * Saves the generated summary text to a "Summary" sheet.
 * Creates the sheet if it doesn't exist and clears previous content.
 * @param {string} summaryText - The summary string to be saved.
 */
function saveSummaryToSheet(summaryText) {
  const summarySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Summary") // Try to get existing sheet.
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Summary"); // Create if not found.
  summarySheet.clear(); // Clear existing content.
  summarySheet.getRange("A1").setValue("Forecast Summary:"); // Add a title.
  summarySheet.getRange("A2").setValue(summaryText); // Add the summary text.
}
