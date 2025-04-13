#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// 🔐 WiFi credentials
const char* ssid = "Drake;)";
const char* password = "Itik4321";

// 🔗 Google Apps Script Web App URL (used to log data to Google Sheets)
const char* scriptURL = "https://script.google.com/macros/s/AKfycbwWahsW1LTBXCXsrgEsAwCTwcKHaCBYOXBIredO9L5qs7VPvOWjf_wBDXdlaASxkoKN/exec";

// 📍 Light sensor analog pin (ESP32 ADC pin)
const int lightSensorPin = 34;

// ⏱️ Interval to send data (in milliseconds) — currently set to 10 seconds
const unsigned long sendInterval = 10000;
unsigned long previousMillis = 0;

// 🔐 Create secure client for HTTPS communication
WiFiClientSecure client;

void setup() {
  Serial.begin(115200);  // Start serial monitor
  delay(1000);           // Wait a second for stability
  Serial.println("📡 ESP32 Light Logger");

  // 🔌 Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("🔌 Connecting to WiFi");

  // Wait until connected
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // ⚠️ Disable SSL certificate verification (not secure for production)
  client.setInsecure();
}

void loop() {
  unsigned long currentMillis = millis();

  // ⏱️ Check if it's time to send data
  if (currentMillis - previousMillis >= sendInterval) {
    previousMillis = currentMillis;

    // 📥 Read raw analog value from the light sensor
    int rawValue = analogRead(lightSensorPin);

    // 🌞 Convert raw sensor value to lux (approximate scaling)
    float luxValue = map(rawValue, 0, 4095, 0, 10000) / 100.0;

    Serial.print("💡 Light: ");
    Serial.println(luxValue);  // Print lux value to Serial Monitor

    // ✅ If WiFi is connected, send data to Google Sheets
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient https;

      // 📡 Start HTTPS POST request
      https.begin(client, scriptURL);
      https.addHeader("Content-Type", "application/json");

      // 🧾 Prepare JSON payload with the lux value
      StaticJsonDocument<200> doc;
      doc["light"] = luxValue;

      String json;
      serializeJson(doc, json);

      // 📤 Send POST request
      int httpCode = https.POST(json);
      String response = https.getString();

      // 📬 Print server response
      Serial.print("📤 HTTP Code: ");
      Serial.println(httpCode);
      Serial.println("📨 Response: " + response);

      https.end();  // 🔚 Close connection
    } else {
      Serial.println("❌ WiFi not connected.");
    }
  }
}
