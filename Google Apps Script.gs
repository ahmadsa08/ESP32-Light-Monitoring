// ✅ Handles GET requests (for testing or API access)
function doGet(e) {
  // Returns a simple text response confirming the script is working
  return ContentService.createTextOutput("✅ Google Apps Script is reachable!");
}

// ✅ Handles POST requests to log sensor data
function doPost(e) {
  try {
    // Get the active sheet (usually "Sheet1")
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parse the incoming JSON payload from the POST request
    var data = JSON.parse(e.postData.contents);
    
    // Extract the 'light' value from the parsed JSON
    var light = data.light;
    
    // Append a new row with current timestamp and light sensor reading
    sheet.appendRow([new Date(), light]);

    // Return a success response in JSON format
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data logged successfully"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return an error response in case something goes wrong
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ✅ Adds a custom menu to the Google Sheets UI on open
function onOpen() {
  var ui = SpreadsheetApp.getUi(); // Get UI object
  // Create a custom menu named "Sensor Data"
  ui.createMenu('Sensor Data')
    .addItem('Generate Forecasts (EMA & Holt-Winters)', 'generateCombinedForecasts') // Menu item to run forecast
    .addItem('Clear All Data', 'clearData') // Menu item to clear forecast data
    .addToUi(); // Add menu to the UI
}

// ✅ Main function to generate both EMA and Holt-Winters forecasts
function generateCombinedForecasts() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1"); // Input sheet
  var forecastSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Forecasts"); // Output sheet

  // If "Forecasts" sheet doesn't exist, create it
  if (!forecastSheet) {
    forecastSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Forecasts");
  } else {
    forecastSheet.clear(); // Otherwise, clear old content
  }

  // Append headers for the forecast results
  forecastSheet.appendRow([
    "Timestamp",
    "EMA Forecast", "EMA Forecast Upper", "EMA Forecast Lower",
    "Holt-Winters Forecast", "Holt-Winters Forecast Upper", "Holt-Winters Forecast Lower"
  ]);

  // Check if there is data to process
  if (sheet.getLastRow() < 2) {
    Logger.log("No data available in Sheet1.");
    return;
  }

  // Get all sensor data excluding header
  var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  var values = dataRange.getValues(); // 2D array [timestamp, light]
  var timestamps = [], sensorValues = [];

  // Separate data into individual arrays
  for (var i = 0; i < values.length; i++) {
    timestamps.push(values[i][0]);
    sensorValues.push(values[i][1]);
  }

  // Get the latest recorded timestamp and value
  var currentTimestamp = timestamps[timestamps.length - 1];
  var currentSensorValue = sensorValues[sensorValues.length - 1];

  // Add the most recent reading to Forecasts sheet as reference
  forecastSheet.appendRow([
    currentTimestamp,
    currentSensorValue, currentSensorValue * 1.1, currentSensorValue * 0.9,
    currentSensorValue, currentSensorValue * 1.1, currentSensorValue * 0.9
  ]);

  // Generate 24 future forecasts using both methods
  var emaForecasts = calculateEMAForecasts(timestamps, sensorValues);
  var hwForecasts = calculateHoltWintersForecasts(timestamps, sensorValues);

  // Append each forecast row to the Forecasts sheet
  for (var i = 0; i < emaForecasts.length; i++) {
    forecastSheet.appendRow([
      emaForecasts[i].timestamp,
      emaForecasts[i].forecastValue,
      emaForecasts[i].upperBound,
      emaForecasts[i].lowerBound,
      hwForecasts[i].forecastValue,
      hwForecasts[i].upperBound,
      hwForecasts[i].lowerBound
    ]);
  }

  // Create chart comparing both forecast methods
  createCombinedChart(forecastSheet);
}

// ✅ Generates EMA forecasts for next 24 hours
function calculateEMAForecasts(timestamps, values) {
  var forecasts = [];
  var smoothingFactor = 0.1; // Adjust for sensitivity
  var lastTimestamp = new Date(timestamps[timestamps.length - 1]);

  // Calculate the latest EMA value
  var forecastValue = calculateEMA(values, smoothingFactor);

  // Create 24 hourly forecast values using last EMA
  for (var i = 1; i <= 24; i++) {
    var nextTimestamp = new Date(lastTimestamp.getTime() + (i * 60 * 60 * 1000));
    forecasts.push({
      timestamp: nextTimestamp,
      forecastValue: forecastValue,
      upperBound: forecastValue * 1.1, // +10%
      lowerBound: forecastValue * 0.9  // -10%
    });
  }
  return forecasts;
}

// ✅ Helper function to calculate a single EMA value from data
function calculateEMA(values, smoothingFactor) {
  if (values.length < 1) return null; // No data check
  var ema = values[0]; // Start with first value
  for (var i = 1; i < values.length; i++) {
    ema = smoothingFactor * values[i] + (1 - smoothingFactor) * ema;
  }
  return ema;
}

// ✅ Holt-Winters additive model forecast for next 24 hours
function calculateHoltWintersForecasts(timestamps, values) {
  var forecasts = [];
  if (values.length < 3) return forecasts; // Needs at least 3 data points

  // Define smoothing constants
  var alpha = 0.3; // Level
  var beta = 0.1;  // Trend

  var L = values[0]; // Initial level
  var T = values[1] - values[0]; // Initial trend estimate
  var lastTimestamp = new Date(timestamps[timestamps.length - 1]);

  // Update level and trend values using the full series
  for (var i = 1; i < values.length; i++) {
    var lastL = L;
    L = alpha * values[i] + (1 - alpha) * (L + T); // Level update
    T = beta * (L - lastL) + (1 - beta) * T;       // Trend update
  }

  // Generate 24 future predictions
  for (var i = 1; i <= 24; i++) {
    var forecastValue = L + i * T;
    var nextTimestamp = new Date(lastTimestamp.getTime() + i * 60 * 60 * 1000);
    forecasts.push({
      timestamp: nextTimestamp,
      forecastValue: forecastValue,
      upperBound: forecastValue * 1.1,
      lowerBound: forecastValue * 0.9
    });
  }

  return forecasts;
}

// ✅ Builds a combined chart to visualize forecasts
function createCombinedChart(sheet) {
  // Remove existing charts before inserting a new one
  var charts = sheet.getCharts();
  for (var i = 0; i < charts.length; i++) {
    sheet.removeChart(charts[i]);
  }

  var lastRow = sheet.getLastRow(); // Find last row with data
  var chartRange = sheet.getRange("A1:G" + lastRow); // Select range for chart

  // Build a multi-line chart with different colors and line styles
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(chartRange)
    .setPosition(2, 9, 0, 0) // Place it on right side of sheet
    .setOption('title', 'Forecasts Comparison: EMA vs Holt-Winters')
    .setOption('curveType', 'function') // Smooth lines
    .setOption('legend', { position: 'bottom' })
    .setOption('hAxis', {
      title: 'Timestamp',
      format: 'M/dd/yyyy h:mm:ss'
    })
    .setOption('vAxis', {
      title: 'Light Intensity (lux)',
      viewWindow: {
        min: 0,
        max: 0.0004 // Adjust this as per your sensor data range
      }
    })
    .setOption('series', {
      0: { label: 'Current Sensor Data', color: 'black', lineWidth: 2 },
      1: { label: 'EMA Forecast', color: 'blue', lineWidth: 2 },
      2: { label: 'Holt-Winters Forecast', color: 'green', lineWidth: 3 },
      3: { label: 'EMA Forecast Upper', color: 'red', lineWidth: 1, lineDashStyle: [2, 2] },
      4: { label: 'EMA Forecast Lower', color: 'gold', lineWidth: 1, lineDashStyle: [2, 2] },
      5: { label: 'Holt-Winters Forecast Upper', color: 'darkorange', lineWidth: 1, lineDashStyle: [2, 2] },
      6: { label: 'Holt-Winters Forecast Lower', color: 'darkcyan', lineWidth: 1, lineDashStyle: [2, 2] }
    })
    .build(); // Finalize the chart

  sheet.insertChart(chart); // Add the chart to sheet

  // Add a text description below the chart to explain lines
  var description = "Current Data (black line): Represents actual sensor values.\n" +
                    "EMA Forecast (blue line): Forecasted values using Exponential Moving Average (EMA).\n" +
                    "Holt-Winters Forecast (green line): Forecasted values using Holt-Winters method.\n" +
                    "Prediction Ranges (red, gold, darkorange, darkcyan lines): Upper and lower bounds of forecasts.\n" +
                    "Note: The green line (Holt-Winters) is bolder for better visibility.";
  
  // Place the description 2 rows after the last chart data
  sheet.getRange("A" + (lastRow + 2)).setValue(description);
}

// ✅ Clears forecast data from the "Forecasts" sheet only
function clearData() {
  var forecastSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Forecasts");
  
  // Only clear if data exists beyond header
  if (forecastSheet && forecastSheet.getLastRow() > 1) {
    forecastSheet.getRange(2, 1, forecastSheet.getLastRow() - 1, forecastSheet.getLastColumn()).clear();
    Logger.log("Forecast data cleared.");
  } else {
    Logger.log("No Forecasts sheet or no data to clear.");
  }
}
