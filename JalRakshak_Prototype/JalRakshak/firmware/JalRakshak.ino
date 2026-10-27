/**
 * ==============================================================================
 * JALRAKSHAK: Intelligent Water Quality Monitoring and Early Warning System
 * Firmware version: 1.0.0-PROTOTYPE
 * Target Hardware: ESP32 DevKit V1 (ESP-WROOM-32)
 * Framework: Arduino ESP32
 * 
 * Pipeline: SENSE -> VALIDATE -> COMPARE -> ALERT -> LOG -> VERIFY -> ACT
 * 
 * Scientific Disclaimer:
 * JalRakshak is an early-warning and continuous monitoring prototype. It does
 * NOT certify water potability and cannot detect microbiological pathogens
 * (such as bacteria, viruses, cysts) or trace heavy metals. Readings must be
 * validated with certified reference methods and laboratory assays.
 * ==============================================================================
 */

// If config.h exists (created by user), use it. Otherwise fall back to config.example.h.
#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.example.h"
#endif

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <FS.h>
#include <SD.h>
#include <SPIFFS.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#if ENABLE_WIFI_AP
  #include <WiFi.h>
  #include <WebServer.h>
#endif

// ==============================================================================
// HARDWARE PERIPHERAL INSTANCES
// ==============================================================================
OneWire oneWireBus(PIN_ONE_WIRE_BUS);
DallasTemperature tempSensors(&oneWireBus);
Adafruit_SSD1306 oledDisplay(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);

#if ENABLE_WIFI_AP
  WebServer webServer(WIFI_WEB_PORT);
#endif

// ==============================================================================
// SYSTEM DATA STRUCTURES
// ==============================================================================
enum SensorHealth {
  HEALTH_OK = 0,
  HEALTH_DISCONNECTED = 1,
  HEALTH_OUT_OF_RANGE = 2,
  HEALTH_UNSTABLE = 3
};

enum AlertSeverity {
  SEVERITY_NORMAL = 0,
  SEVERITY_WARNING = 1,
  SEVERITY_CRITICAL = 2,
  SEVERITY_FAULT = 3
};

struct SensorReadings {
  float ph;
  float turbidityNtu;
  float ecUsCm;
  float temperatureC;
  
  float rawPhVolt;
  float rawTurbVolt;
  float rawEcVolt;

  SensorHealth phHealth;
  SensorHealth turbHealth;
  SensorHealth ecHealth;
  SensorHealth tempHealth;
};

struct SystemStatus {
  AlertSeverity overallSeverity;
  char activeAlerts[128];
  uint32_t consecutiveFaultCount;
  uint32_t sampleCount;
  uint32_t uptimeSeconds;
};

// Global state variables
SensorReadings currentReadings;
SystemStatus sysStatus;
bool oledAvailable = false;
bool sdCardAvailable = false;
bool spiffsAvailable = false;
unsigned long lastSampleTime = 0;
unsigned long buzzerLastToggle = 0;
bool buzzerState = false;

// ==============================================================================
// FUNCTION PROTOTYPES
// ==============================================================================
void setupHardware();
void initializeDisplay();
void initializeStorage();
void setupWiFiAP();
void executeMonitoringCycle();

// SENSE
void readRawSensors(SensorReadings &readings);
float readFilteredVoltage(uint8_t pin, uint8_t samples);

// VALIDATE
void validateSensors(SensorReadings &readings);

// COMPARE
void evaluateAnomalies(SensorReadings &readings, SystemStatus &status);

// ALERT
void updateLocalActuators(const SystemStatus &status);
void soundBuzzerPattern(AlertSeverity severity);

// LOG
void logToSerial(const SensorReadings &readings, const SystemStatus &status);
void logToStorage(const SensorReadings &readings, const SystemStatus &status);
void updateOledDisplay(const SensorReadings &readings, const SystemStatus &status);

// String helpers
const char* healthToString(SensorHealth health);
const char* severityToString(AlertSeverity severity);

// ==============================================================================
// ARDUINO SETUP
// ==============================================================================
void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000); // Allow USB serial terminal connection

  Serial.println(F("\n========================================================"));
  Serial.println(F(" JalRakshak: Intelligent Water Quality Monitoring Node  "));
  Serial.println(F(" Open-Source Offline-First Early Warning Prototype     "));
  Serial.println(F("========================================================"));
  Serial.printf("Device ID: %s | Firmware: %s\n", DEVICE_ID, FIRMWARE_VERSION);

  setupHardware();
  initializeDisplay();
  initializeStorage();

#if ENABLE_WIFI_AP
  setupWiFiAP();
#endif

  sysStatus.overallSeverity = SEVERITY_NORMAL;
  strcpy(sysStatus.activeAlerts, "NONE");
  sysStatus.consecutiveFaultCount = 0;
  sysStatus.sampleCount = 0;
  sysStatus.uptimeSeconds = 0;

  Serial.println(F("[SYSTEM] Initialization complete. Beginning SENSE cycle."));
}

// ==============================================================================
// ARDUINO MAIN LOOP
// ==============================================================================
void loop() {
  unsigned long now = millis();
  sysStatus.uptimeSeconds = now / 1000;

#if ENABLE_WIFI_AP
  webServer.handleClient();
#endif

  // Execute periodic monitoring cycle
  if (now - lastSampleTime >= SAMPLING_INTERVAL_MS) {
    lastSampleTime = now;
    executeMonitoringCycle();
  }

  // Handle continuous non-blocking buzzer pattern
  soundBuzzerPattern(sysStatus.overallSeverity);
}

// ==============================================================================
// PIPELINE EXECUTION: SENSE -> VALIDATE -> COMPARE -> ALERT -> LOG
// ==============================================================================
void executeMonitoringCycle() {
  sysStatus.sampleCount++;

  // Step 1: SENSE
  readRawSensors(currentReadings);

  // Step 2: VALIDATE
  validateSensors(currentReadings);

  // Step 3: COMPARE
  evaluateAnomalies(currentReadings, sysStatus);

  // Step 4: ALERT
  updateLocalActuators(sysStatus);

  // Step 5: LOG & DISPLAY
  logToSerial(currentReadings, sysStatus);
  logToStorage(currentReadings, sysStatus);
  updateOledDisplay(currentReadings, sysStatus);
}

// ==============================================================================
// STEP 1: SENSE - Read ADC Voltages & 1-Wire Digital Probes
// ==============================================================================
void readRawSensors(SensorReadings &readings) {
  // Read multi-sampled filtered analog voltages (in Volts)
  readings.rawPhVolt   = readFilteredVoltage(PIN_PH_ANALOG, ADC_SAMPLES_PER_READ);
  readings.rawTurbVolt = readFilteredVoltage(PIN_TURBIDITY_ANALOG, ADC_SAMPLES_PER_READ);
  readings.rawEcVolt   = readFilteredVoltage(PIN_EC_ANALOG, ADC_SAMPLES_PER_READ);

  // Read DS18B20 1-Wire temperature
  tempSensors.requestTemperatures();
  float rawTemp = tempSensors.getTempCByIndex(0);
  readings.temperatureC = rawTemp + TEMP_OFFSET_C;

  // Convert raw voltage to calibrated physical units:
  // 1. pH calculation
  readings.ph = (PH_CALIBRATION_SLOPE * readings.rawPhVolt) + PH_CALIBRATION_INTERCEPT;

  // 2. Turbidity calculation (Linear or polynomial transfer function)
  readings.turbidityNtu = (TURB_CALIBRATION_SLOPE * readings.rawTurbVolt) + TURB_CALIBRATION_OFFSET;
  if (readings.turbidityNtu < TURB_MIN_CLAMP_NTU) readings.turbidityNtu = TURB_MIN_CLAMP_NTU;
  if (readings.turbidityNtu > TURB_MAX_CLAMP_NTU) readings.turbidityNtu = TURB_MAX_CLAMP_NTU;

  // 3. Electrical Conductivity with Temperature Compensation
  // Standard normalization formula: EC_25 = EC_raw / (1 + alpha * (T - 25))
  float tempCompFactor = 1.0f + EC_TEMP_COEFFICIENT * (readings.temperatureC - EC_REFERENCE_TEMP_C);
  if (tempCompFactor < 0.5f) tempCompFactor = 0.5f; // Protect against division by zero/extreme cold
  
  float rawEc = readings.rawEcVolt * EC_CALIBRATION_FACTOR;
  readings.ecUsCm = rawEc / tempCompFactor;
  if (readings.ecUsCm < 0.0f) readings.ecUsCm = 0.0f;
}

// Analog multi-sampling and median filtering to eliminate electrical noise
float readFilteredVoltage(uint8_t pin, uint8_t samples) {
  float rawSum = 0.0f;
  for (uint8_t i = 0; i < samples; i++) {
    // analogReadMilliVolts() utilizes internal ESP32 ADC calibration curves
    rawSum += (float)analogReadMilliVolts(pin);
    delay(3);
  }
  float avgMilliVolts = rawSum / (float)samples;
  return avgMilliVolts / 1000.0f; // Return in Volts
}

// ==============================================================================
// STEP 2: VALIDATE - Fault Detection (Disconnected, Saturated, Malformed)
// ==============================================================================
void validateSensors(SensorReadings &readings) {
  // 1. Validate pH Sensor
  if (readings.rawPhVolt <= VOLT_MIN_DISCONNECTED || readings.rawPhVolt >= VOLT_MAX_SATURATED) {
    readings.phHealth = HEALTH_DISCONNECTED;
    readings.ph = -1.0f; // Marker for invalid reading
  } else if (readings.ph < 0.0f || readings.ph > 14.0f) {
    readings.phHealth = HEALTH_OUT_OF_RANGE;
  } else {
    readings.phHealth = HEALTH_OK;
  }

  // 2. Validate Turbidity Sensor
  if (readings.rawTurbVolt <= VOLT_MIN_DISCONNECTED || readings.rawTurbVolt >= VOLT_MAX_SATURATED) {
    readings.turbHealth = HEALTH_DISCONNECTED;
    readings.turbidityNtu = -1.0f;
  } else {
    readings.turbHealth = HEALTH_OK;
  }

  // 3. Validate EC Sensor
  if (readings.rawEcVolt <= VOLT_MIN_DISCONNECTED && readings.rawEcVolt < 0.01f) {
    // EC reads ~0V in open air; valid condition when probe not immersed
    readings.ecHealth = HEALTH_OK;
  } else if (readings.rawEcVolt >= VOLT_MAX_SATURATED) {
    readings.ecHealth = HEALTH_OUT_OF_RANGE;
  } else {
    readings.ecHealth = HEALTH_OK;
  }

  // 4. Validate DS18B20 Temperature
  // DS18B20 returns -127°C on communication failure or disconnected data line
  // Returns 85°C on initial power-up conversion failure
  if (readings.temperatureC <= -100.0f || readings.temperatureC >= 84.9f && readings.temperatureC <= 85.1f) {
    readings.tempHealth = HEALTH_DISCONNECTED;
    readings.temperatureC = -999.0f;
  } else if (readings.temperatureC < -10.0f || readings.temperatureC > 70.0f) {
    readings.tempHealth = HEALTH_OUT_OF_RANGE;
  } else {
    readings.tempHealth = HEALTH_OK;
  }
}

// ==============================================================================
// STEP 3: COMPARE - Baseline Deviation & Debounced Anomaly Detection
// ==============================================================================
void evaluateAnomalies(SensorReadings &readings, SystemStatus &status) {
  bool hasFault = false;
  bool hasCritical = false;
  bool hasWarning = false;
  char alertBuffer[128] = "";

  // Check for hardware faults first
  if (readings.phHealth != HEALTH_OK) {
    hasFault = true;
    strcat(alertBuffer, "FAULT_PH ");
  }
  if (readings.turbHealth != HEALTH_OK) {
    hasFault = true;
    strcat(alertBuffer, "FAULT_TURB ");
  }
  if (readings.tempHealth != HEALTH_OK) {
    hasFault = true;
    strcat(alertBuffer, "FAULT_TEMP ");
  }

  // Check water quality parameters only when sensors are healthy
  if (readings.phHealth == HEALTH_OK) {
    if (readings.ph <= PH_CRIT_LOW) {
      hasCritical = true;
      strcat(alertBuffer, "CRIT_PH_ACIDIC ");
    } else if (readings.ph >= PH_CRIT_HIGH) {
      hasCritical = true;
      strcat(alertBuffer, "CRIT_PH_ALKALINE ");
    } else if (readings.ph < PH_WARN_LOW) {
      hasWarning = true;
      strcat(alertBuffer, "WARN_PH_LOW ");
    } else if (readings.ph > PH_WARN_HIGH) {
      hasWarning = true;
      strcat(alertBuffer, "WARN_PH_HIGH ");
    }
  }

  if (readings.turbHealth == HEALTH_OK) {
    if (readings.turbidityNtu >= TURB_CRIT_HIGH) {
      hasCritical = true;
      strcat(alertBuffer, "CRIT_TURBIDITY ");
    } else if (readings.turbidityNtu >= TURB_WARN_HIGH) {
      hasWarning = true;
      strcat(alertBuffer, "WARN_TURBIDITY ");
    }
  }

  if (readings.ecHealth == HEALTH_OK) {
    if (readings.ecUsCm >= EC_CRIT_HIGH) {
      hasCritical = true;
      strcat(alertBuffer, "CRIT_EC_SPIKE ");
    } else if (readings.ecUsCm >= EC_WARN_HIGH) {
      hasWarning = true;
      strcat(alertBuffer, "WARN_EC_ELEVATED ");
    }
  }

  if (readings.tempHealth == HEALTH_OK) {
    if (readings.temperatureC >= TEMP_CRIT_HIGH) {
      hasCritical = true;
      strcat(alertBuffer, "CRIT_TEMP_HIGH ");
    } else if (readings.temperatureC >= TEMP_WARN_HIGH || readings.temperatureC <= TEMP_WARN_LOW) {
      hasWarning = true;
      strcat(alertBuffer, "WARN_TEMP_DRIFT ");
    }
  }

  // Determine instantaneous severity
  AlertSeverity rawSeverity = SEVERITY_NORMAL;
  if (hasFault) {
    rawSeverity = SEVERITY_FAULT;
  } else if (hasCritical) {
    rawSeverity = SEVERITY_CRITICAL;
  } else if (hasWarning) {
    rawSeverity = SEVERITY_WARNING;
  }

  // Hysteresis / Debouncing Filter:
  // Requires ANOMALY_DEBOUNCE_CYCLES consecutive abnormal reads before triggering alarm
  if (rawSeverity != SEVERITY_NORMAL) {
    status.consecutiveFaultCount++;
    if (status.consecutiveFaultCount >= ANOMALY_DEBOUNCE_CYCLES) {
      status.overallSeverity = rawSeverity;
      if (strlen(alertBuffer) > 0) {
        strncpy(status.activeAlerts, alertBuffer, sizeof(status.activeAlerts) - 1);
        status.activeAlerts[sizeof(status.activeAlerts) - 1] = '\0';
      }
    }
  } else {
    // Normal baseline: reset counter
    if (status.consecutiveFaultCount > 0) {
      status.consecutiveFaultCount--;
    }
    if (status.consecutiveFaultCount == 0) {
      status.overallSeverity = SEVERITY_NORMAL;
      strcpy(status.activeAlerts, "NONE");
    }
  }
}

// ==============================================================================
// STEP 4: ALERT - Actuator Control (LEDs and Buzzer)
// ==============================================================================
void updateLocalActuators(const SystemStatus &status) {
  switch (status.overallSeverity) {
    case SEVERITY_NORMAL:
      digitalWrite(PIN_LED_NORMAL, HIGH);
      digitalWrite(PIN_LED_WARNING, LOW);
      digitalWrite(PIN_LED_CRITICAL, LOW);
      break;

    case SEVERITY_WARNING:
      digitalWrite(PIN_LED_NORMAL, LOW);
      digitalWrite(PIN_LED_WARNING, HIGH);
      digitalWrite(PIN_LED_CRITICAL, LOW);
      break;

    case SEVERITY_CRITICAL:
    case SEVERITY_FAULT:
      digitalWrite(PIN_LED_NORMAL, LOW);
      digitalWrite(PIN_LED_WARNING, LOW);
      digitalWrite(PIN_LED_CRITICAL, HIGH);
      break;
  }
}

void soundBuzzerPattern(AlertSeverity severity) {
  unsigned long now = millis();

  if (severity == SEVERITY_NORMAL) {
    digitalWrite(PIN_BUZZER, LOW);
    buzzerState = false;
    return;
  }

  if (severity == SEVERITY_WARNING) {
    // Intermittent chirp: 100ms ON every 4 seconds
    unsigned long cycle = now % 4000;
    if (cycle < 100) {
      digitalWrite(PIN_BUZZER, HIGH);
    } else {
      digitalWrite(PIN_BUZZER, LOW);
    }
  } else if (severity == SEVERITY_CRITICAL || severity == SEVERITY_FAULT) {
    // Fast urgent alarm: 250ms ON, 250ms OFF
    unsigned long cycle = now % 500;
    if (cycle < 250) {
      digitalWrite(PIN_BUZZER, HIGH);
    } else {
      digitalWrite(PIN_BUZZER, LOW);
    }
  }
}

// ==============================================================================
// STEP 5: LOGGING & VISUALIZATION
// ==============================================================================

// Output structured JSON over USB serial for Web Serial dashboard consumption
void logToSerial(const SensorReadings &readings, const SystemStatus &status) {
  Serial.print(F("{\"deviceId\":\""));
  Serial.print(DEVICE_ID);
  Serial.print(F("\",\"uptime\":"));
  Serial.print(status.uptimeSeconds);
  Serial.print(F(",\"sample\":"));
  Serial.print(status.sampleCount);
  Serial.print(F(",\"readings\":{"));
  
  Serial.print(F("\"ph\":"));
  if (readings.phHealth == HEALTH_OK) Serial.print(readings.ph, 2); else Serial.print(F("null"));
  
  Serial.print(F(",\"turbidity\":"));
  if (readings.turbHealth == HEALTH_OK) Serial.print(readings.turbidityNtu, 2); else Serial.print(F("null"));
  
  Serial.print(F(",\"ec\":"));
  if (readings.ecHealth == HEALTH_OK) Serial.print(readings.ecUsCm, 1); else Serial.print(F("null"));
  
  Serial.print(F(",\"temperature\":"));
  if (readings.tempHealth == HEALTH_OK) Serial.print(readings.temperatureC, 2); else Serial.print(F("null"));

  Serial.print(F("},\"rawVolts\":{"));
  Serial.print(F("\"ph\":")); Serial.print(readings.rawPhVolt, 3);
  Serial.print(F(",\"turbidity\":")); Serial.print(readings.rawTurbVolt, 3);
  Serial.print(F(",\"ec\":")); Serial.print(readings.rawEcVolt, 3);

  Serial.print(F("},\"health\":{"));
  Serial.print(F("\"ph\":\"")); Serial.print(healthToString(readings.phHealth));
  Serial.print(F("\",\"turbidity\":\"")); Serial.print(healthToString(readings.turbHealth));
  Serial.print(F("\",\"ec\":\"")); Serial.print(healthToString(readings.ecHealth));
  Serial.print(F("\",\"temperature\":\"")); Serial.print(healthToString(readings.tempHealth));

  Serial.print(F("\"},\"status\":{"));
  Serial.print(F("\"overall\":\"")); Serial.print(severityToString(status.overallSeverity));
  Serial.print(F("\",\"alerts\":\"")); Serial.print(status.activeAlerts);
  Serial.println(F("\"}}"));
}

// Append CSV record to MicroSD card or SPIFFS
void logToStorage(const SensorReadings &readings, const SystemStatus &status) {
  char csvLine[256];
  snprintf(csvLine, sizeof(csvLine), "%lu,%s,%.2f,%.2f,%.1f,%.2f,%s,%s\n",
    status.uptimeSeconds,
    DEVICE_ID,
    (readings.phHealth == HEALTH_OK ? readings.ph : -1.0f),
    (readings.turbHealth == HEALTH_OK ? readings.turbidityNtu : -1.0f),
    (readings.ecHealth == HEALTH_OK ? readings.ecUsCm : -1.0f),
    (readings.tempHealth == HEALTH_OK ? readings.temperatureC : -999.0f),
    severityToString(status.overallSeverity),
    status.activeAlerts
  );

  if (sdCardAvailable) {
    File f = SD.open(SD_LOG_FILE_PATH, FILE_APPEND);
    if (f) {
      f.print(csvLine);
      f.close();
      return;
    }
  }

  // Fallback to internal SPIFFS flash if SD is missing
  if (spiffsAvailable) {
    File f = SPIFFS.open("/readings_backup.csv", FILE_APPEND);
    if (f) {
      f.print(csvLine);
      f.close();
    }
  }
}

// Update 0.96" I2C OLED display (if hardware is detected)
void updateOledDisplay(const SensorReadings &readings, const SystemStatus &status) {
  if (!oledAvailable) return;

  oledDisplay.clearDisplay();
  oledDisplay.setTextSize(1);
  oledDisplay.setTextColor(SSD1306_WHITE);
  oledDisplay.setCursor(0, 0);

  // Line 1: Header & Status
  oledDisplay.print(F("JalRakshak: "));
  oledDisplay.println(severityToString(status.overallSeverity));

  // Line 2: pH & Turbidity
  oledDisplay.print(F("pH: "));
  if (readings.phHealth == HEALTH_OK) oledDisplay.print(readings.ph, 1); else oledDisplay.print(F("ERR"));
  oledDisplay.print(F(" | Turb: "));
  if (readings.turbHealth == HEALTH_OK) oledDisplay.print(readings.turbidityNtu, 1); else oledDisplay.print(F("ERR"));
  oledDisplay.println();

  // Line 3: EC & Temp
  oledDisplay.print(F("EC: "));
  if (readings.ecHealth == HEALTH_OK) oledDisplay.print((int)readings.ecUsCm); else oledDisplay.print(F("ERR"));
  oledDisplay.print(F("uS | T: "));
  if (readings.tempHealth == HEALTH_OK) oledDisplay.print(readings.temperatureC, 1); else oledDisplay.print(F("ERR"));
  oledDisplay.println(F("C"));

  // Line 4: Alert details
  oledDisplay.print(F("Alert: "));
  if (strcmp(status.activeAlerts, "NONE") == 0) {
    oledDisplay.println(F("NORMAL"));
  } else {
    oledDisplay.println(status.activeAlerts);
  }

  oledDisplay.display();
}

// ==============================================================================
// INITIALIZATION HELPERS
// ==============================================================================
void setupHardware() {
  pinMode(PIN_LED_NORMAL, OUTPUT);
  pinMode(PIN_LED_WARNING, OUTPUT);
  pinMode(PIN_LED_CRITICAL, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Analog inputs
  pinMode(PIN_PH_ANALOG, INPUT);
  pinMode(PIN_TURBIDITY_ANALOG, INPUT);
  pinMode(PIN_EC_ANALOG, INPUT);

  // Initialize status LEDs to safe defaults
  digitalWrite(PIN_LED_NORMAL, HIGH);
  digitalWrite(PIN_LED_WARNING, LOW);
  digitalWrite(PIN_LED_CRITICAL, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Start 1-Wire sensor bus
  tempSensors.begin();
  tempSensors.setWaitForConversion(false); // Non-blocking temperature read
}

void initializeDisplay() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (oledDisplay.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
    oledAvailable = true;
    oledDisplay.clearDisplay();
    oledDisplay.setTextSize(1);
    oledDisplay.setTextColor(SSD1306_WHITE);
    oledDisplay.setCursor(10, 20);
    oledDisplay.println(F("JALRAKSHAK NODE"));
    oledDisplay.setCursor(10, 35);
    oledDisplay.println(F("Initializing..."));
    oledDisplay.display();
    Serial.println(F("[OLED] SSD1306 display initialized successfully."));
  } else {
    oledAvailable = false;
    Serial.println(F("[OLED] Display not detected on I2C bus (optional peripheral)."));
  }
}

void initializeStorage() {
  // Try MicroSD initialization
  SPI.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
  if (SD.begin(PIN_SD_CS)) {
    sdCardAvailable = true;
    Serial.println(F("[SD] MicroSD card initialized."));
    if (!SD.exists(SD_LOG_FILE_PATH)) {
      File f = SD.open(SD_LOG_FILE_PATH, FILE_WRITE);
      if (f) {
        f.println(F("uptime_sec,device_id,ph,turbidity_ntu,ec_us_cm,temp_c,severity,alerts"));
        f.close();
      }
    }
  } else {
    sdCardAvailable = false;
    Serial.println(F("[SD] MicroSD not found. Falling back to internal SPIFFS flash."));
  }

  // Initialize SPIFFS as robust offline fallback
  if (SPIFFS.begin(true)) {
    spiffsAvailable = true;
    Serial.println(F("[SPIFFS] Internal flash storage mounted successfully."));
  } else {
    spiffsAvailable = false;
    Serial.println(F("[SPIFFS] Failed to mount internal flash storage."));
  }
}

#if ENABLE_WIFI_AP
void setupWiFiAP() {
  WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
  IPAddress IP = WiFi.softAPIP();
  Serial.print(F("[WIFI] Access Point launched. SSID: "));
  Serial.print(WIFI_AP_SSID);
  Serial.print(F(" | IP: "));
  Serial.println(IP);

  webServer.on("/api/readings", HTTP_GET, []() {
    String json = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"ph\":" + String(currentReadings.ph) +
                  ",\"turbidity\":" + String(currentReadings.turbidityNtu) +
                  ",\"ec\":" + String(currentReadings.ecUsCm) +
                  ",\"temperature\":" + String(currentReadings.temperatureC) +
                  ",\"severity\":\"" + String(severityToString(sysStatus.overallSeverity)) + "\"}";
    webServer.send(200, "application/json", json);
  });

  webServer.begin();
}
#endif

// ==============================================================================
// HELPER CONVERSIONS
// ==============================================================================
const char* healthToString(SensorHealth health) {
  switch (health) {
    case HEALTH_OK: return "OK";
    case HEALTH_DISCONNECTED: return "DISCONNECTED";
    case HEALTH_OUT_OF_RANGE: return "OUT_OF_RANGE";
    case HEALTH_UNSTABLE: return "UNSTABLE";
    default: return "UNKNOWN";
  }
}

const char* severityToString(AlertSeverity severity) {
  switch (severity) {
    case SEVERITY_NORMAL: return "NORMAL";
    case SEVERITY_WARNING: return "WARNING";
    case SEVERITY_CRITICAL: return "CRITICAL";
    case SEVERITY_FAULT: return "FAULT";
    default: return "UNKNOWN";
  }
}
