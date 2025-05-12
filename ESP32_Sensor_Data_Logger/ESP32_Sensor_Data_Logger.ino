// === Include required libraries ===
#include <WiFi.h>                // For connecting to WiFi
#include <WiFiClientSecure.h>   // For secure HTTPS connection
#include <HTTPClient.h>         // For sending HTTP requests
#include <ArduinoJson.h>        // For creating and parsing JSON

// === WiFi credentials ===
const char* ssid = "Drake;)";          // WiFi SSID (network name)
const char* password = "Itik4321";     // WiFi password

// === Google Apps Script Web App URL ===
const char* scriptURL = "https://script.google.com/macros/s/AKfycbwWahsW1LTBXCXsrgEsAwCTwcKHaCBYOXBIredO9L5qs7VPvOWjf_wBDXdlaASxkoKN/exec";

// === Light sensor input pin ===
const int lightSensorPin = 34;        // Analog input pin for light sensor

// === Timing variables ===
const unsigned long sendInterval = 10000;  // Interval to send data (in milliseconds)
unsigned long previousMillis = 0;          // Stores last time data was sent

// === Secure WiFi client object ===
WiFiClientSecure client;

void setup() {
  Serial.begin(115200);          // Start serial communication
  delay(1000);                   // Short delay before continuing
  Serial.println("📡 ESP32 Light Logger");

  // === Connect to WiFi ===
  WiFi.begin(ssid, password);
  Serial.print("🔌 Connecting to WiFi");

  // Wait until WiFi is connected
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // === Disable SSL certificate verification (not secure for production) ===
  client.setInsecure(); 
}

void loop() {
  unsigned long currentMillis = millis();  // Get current time

  // === Only send data if the interval has passed ===
  if (currentMillis - previousMillis >= sendInterval) {
    previousMillis = currentMillis;  // Update last send time

    // === Read light sensor value ===
    int rawValue = analogRead(lightSensorPin);               // Get raw analog value
    float luxValue = map(rawValue, 0, 4095, 0, 10000) / 100.0; // Convert to lux (scaled 0–100.00)

    Serial.print("💡 Light: ");
    Serial.println(luxValue);  // Print lux value to Serial Monitor

    // === Validate sensor data ===
    if (!validateSensorReading(luxValue)) {
      Serial.println("⚠️ Invalid sensor reading. Skipping this round.");
      return;  // Skip sending if data is invalid
    }

    // === Check WiFi before sending ===
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient https;                         // Create HTTP client
      https.begin(client, scriptURL);           // Begin secure request
      https.addHeader("Content-Type", "application/json"); // Set header

      // === Create JSON payload ===
      StaticJsonDocument<200> doc;
      doc["light"] = luxValue;                  // Add lux value to JSON

      String json;
      serializeJson(doc, json);                 // Convert JSON doc to string

      // === Send POST request ===
      int httpCode = https.POST(json);          // Send the request
      String response = https.getString();      // Read the response

      // === Print HTTP response ===
      Serial.print("📤 HTTP Code: ");
      Serial.println(httpCode);
      Serial.println("📨 Response: " + response);

      https.end();  // End HTTP connection
    } else {
      Serial.println("❌ WiFi not connected.");  // Show error if WiFi is disconnected
    }
  }
}

// === Function: Validate Sensor Reading ===
bool validateSensorReading(float reading) {
  if (isnan(reading)) {
    return false;  // Reject if reading is NaN
  }

  // === Check if reading is within expected range (0–100 lux) ===
  if (reading < 0.0 || reading > 100.0) {
    return false;
  }

  return true;  // Valid reading
}
