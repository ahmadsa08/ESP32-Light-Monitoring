#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "Drake;)";
const char* password = "Itik4321";

// Google Apps Script Web App URL
const char* scriptURL = "https://script.google.com/macros/s/AKfycbwWahsW1LTBXCXsrgEsAwCTwcKHaCBYOXBIredO9L5qs7VPvOWjf_wBDXdlaASxkoKN/exec";

// Light sensor analog pin
const int lightSensorPin = 34;

// Send interval (e.g. 10 seconds)
const unsigned long sendInterval = 10000;
unsigned long previousMillis = 0;

// Secure client
WiFiClientSecure client;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("📡 ESP32 Light Logger");

  WiFi.begin(ssid, password);
  Serial.print("🔌 Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Bypass SSL certificate check
  client.setInsecure();
}

void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= sendInterval) {
    previousMillis = currentMillis;

    int rawValue = analogRead(lightSensorPin);
    float luxValue = map(rawValue, 0, 4095, 0, 10000) / 100.0;

    Serial.print("💡 Light: ");
    Serial.println(luxValue);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient https;
      https.begin(client, scriptURL);  // Secure connection with WiFiClientSecure
      https.addHeader("Content-Type", "application/json");

      StaticJsonDocument<200> doc;
      doc["light"] = luxValue;

      String json;
      serializeJson(doc, json);

      int httpCode = https.POST(json);
      String response = https.getString();

      Serial.print("📤 HTTP Code: ");
      Serial.println(httpCode);
      Serial.println("📨 Response: " + response);

      https.end();
    } else {
      Serial.println("❌ WiFi not connected.");
    }
  }
}
