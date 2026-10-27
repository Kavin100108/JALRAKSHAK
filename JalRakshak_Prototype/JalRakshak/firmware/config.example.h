/**
 * ==============================================================================
 * JalRakshak: Intelligent Water Quality Monitoring and Early Warning System
 * File: config.example.h
 * 
 * Instructions:
 * Copy this file to "config.h" and adjust calibration parameters for your
 * physical sensors. "config.h" is gitignored to prevent accidental exposure of
 * local Wi-Fi credentials.
 * ==============================================================================
 */

#ifndef CONFIG_H
#define CONFIG_H

// ==============================================================================
// 1. DEVICE IDENTIFICATION
// ==============================================================================
#define DEVICE_ID             "JR-NODE-01"
#define FIRMWARE_VERSION      "1.0.0-PROTOTYPE"
#define SAMPLING_INTERVAL_MS  2000    // Main sensor sampling interval (2 seconds)
#define SERIAL_BAUD_RATE      115200  // USB Serial communication rate

// ==============================================================================
// 2. HARDWARE PIN ASSIGNMENTS (ESP32 DevKit 30/38 pin)
// Note: All analog sensors use ADC1 pins to ensure uninterrupted operation when
// Wi-Fi or Bluetooth is enabled (ADC2 pins conflict with wireless radio).
// ==============================================================================

// Analog Sensors (ADC1 only)
#define PIN_PH_ANALOG         34   // ADC1_CH6 (Input Only, high impedance)
#define PIN_TURBIDITY_ANALOG  35   // ADC1_CH7 (Input Only)
#define PIN_EC_ANALOG         32   // ADC1_CH4 (Analog In / Out)

// Digital 1-Wire Temperature Sensor
#define PIN_ONE_WIRE_BUS      4    // DS18B20 1-Wire data (requires 4.7k pull-up to 3.3V)

// Local Status Actuators
#define PIN_LED_NORMAL        25   // Green LED (Normal condition)
#define PIN_LED_WARNING       26   // Yellow / Amber LED (Warning condition)
#define PIN_LED_CRITICAL      27   // Red LED (Critical alert or sensor fault)
#define PIN_BUZZER            14   // Active/Passive Piezo Buzzer

// Optional I2C OLED Display (SSD1306 128x64)
#define PIN_I2C_SDA           21   // Standard ESP32 I2C Data
#define PIN_I2C_SCL           22   // Standard ESP32 I2C Clock
#define OLED_RESET_PIN        -1   // Shared reset pin (-1 if not used)
#define OLED_SCREEN_WIDTH     128
#define OLED_SCREEN_HEIGHT    64
#define OLED_I2C_ADDRESS      0x3C

// Optional MicroSD Card Module (VSPI bus)
#define PIN_SD_CS             5    // Chip Select
#define PIN_SD_MOSI           23   // Master Out Slave In
#define PIN_SD_MISO           19   // Master In Slave Out
#define PIN_SD_SCK            18   // SPI Clock
#define SD_LOG_FILE_PATH      "/readings.csv"

// ==============================================================================
// 3. ELECTRICAL ADC & POWER CALIBRATION
// ESP32 default ADC resolution is 12-bit (0 - 4095). Reference voltage is ~3.3V.
// Due to internal non-linearity, ESP32 ADC is reliable between ~0.15V and 3.10V.
// ==============================================================================
#define ADC_RESOLUTION_BITS   12
#define ADC_MAX_RAW_VALUE     4095.0f
#define VREF_VOLTAGE          3.30f  // Measured reference voltage of ESP32 3.3V rail
#define ADC_SAMPLES_PER_READ  10     // Number of ADC samples averaged per cycle

// Electrical bounds for disconnected probe / open-circuit fault detection
#define VOLT_MIN_DISCONNECTED 0.10f  // Voltages below 100mV indicate disconnected probe
#define VOLT_MAX_SATURATED    3.20f  // Voltages near 3.3V indicate rail saturation / short

// ==============================================================================
// 4. SENSOR CALIBRATION PARAMETERS
// These values MUST be determined via physical calibration using reference solutions!
// 
// pH Sensor (Analog pH-4502C or similar):
//   pH = PH_SLOPE * voltage + PH_INTERCEPT
//   Typically for 0-3.3V scaled output: at pH 7.00, V ~ 2.5V (with divider: ~1.65V)
// ==============================================================================
#define PH_CALIBRATION_SLOPE      -5.70f  // pH change per volt
#define PH_CALIBRATION_INTERCEPT  15.50f  // Zero-volt extrapolated intercept

// Turbidity Sensor (Analog optical module):
//   Higher NTU = more light scatter = lower voltage output to phototransistor
//   Approximate model: NTU = -1120.4 * (V^2) + 5742.3 * V - 4352.9
//   For linear educational approximation: NTU = TURB_SLOPE * voltage + TURB_OFFSET
#define TURB_CALIBRATION_SLOPE    -120.0f
#define TURB_CALIBRATION_OFFSET   350.0f
#define TURB_MIN_CLAMP_NTU        0.0f
#define TURB_MAX_CLAMP_NTU        1000.0f

// Electrical Conductivity (EC / TDS Analog probe):
//   EC (uS/cm) = (voltage / cell_constant) * temperature_factor
#define EC_CALIBRATION_FACTOR     1000.0f // Scale factor in uS/cm per volt
#define EC_TEMP_COEFFICIENT       0.020f  // 2.0% per degree Celsius standard compensation
#define EC_REFERENCE_TEMP_C       25.0f   // Reference temperature standard (25°C)

// Temperature Sensor (DS18B20 digital sensor):
//   DS18B20 reports internal calibrated temperature. Offset allows field trim.
#define TEMP_OFFSET_C             0.0f

// ==============================================================================
// 5. BASELINE & THRESHOLD DEFINITIONS
// IMPORTANT: These thresholds are illustrative benchmarks informed by general
// drinking water guidelines (such as Bureau of Indian Standards IS 10500:2012
// and WHO guidance). They DO NOT certify water as safe or potable.
// Local context, seasonal baselines, and certified laboratory testing must govern.
// ==============================================================================

// pH Thresholds (IS 10500: Acceptable 6.5 - 8.5)
#define PH_BASELINE_TYPICAL       7.20f
#define PH_WARN_LOW               6.50f
#define PH_WARN_HIGH              8.50f
#define PH_CRIT_LOW               6.00f
#define PH_CRIT_HIGH              9.00f

// Turbidity Thresholds in NTU (IS 10500: Acceptable 1.0 NTU, Permissible 5.0 NTU)
#define TURB_BASELINE_TYPICAL     0.80f
#define TURB_WARN_HIGH            5.00f   // Noticeable cloudiness / permissible limit
#define TURB_CRIT_HIGH            10.00f  // Significant particulate or sediment contamination

// Electrical Conductivity Thresholds in uS/cm (Typical potable groundwater < 500-800 uS/cm)
#define EC_BASELINE_TYPICAL       350.0f
#define EC_WARN_HIGH              800.0f  // Elevated mineral / ionic concentration
#define EC_CRIT_HIGH              1500.0f // Severe dissolved solids or brackish intrusion

// Water Temperature Thresholds in °C
#define TEMP_WARN_LOW             5.0f
#define TEMP_WARN_HIGH            35.0f
#define TEMP_CRIT_HIGH            45.0f

// ==============================================================================
// 6. ANOMALY DETECTION DEBOUNCE (Hysteresis Filter)
// Prevents intermittent noise spikes from triggering false alarms.
// The abnormal condition must be detected for N consecutive reading cycles.
// ==============================================================================
#define ANOMALY_DEBOUNCE_CYCLES   3       // 3 cycles * 2s = 6 seconds sustained fault

// ==============================================================================
// 7. OPTIONAL WI-FI ACCESS POINT (LOCAL WEB SERVER / REST API)
// If enabled, ESP32 broadcasts a local Wi-Fi hotspot with captive portal/dashboard
// ==============================================================================
#define ENABLE_WIFI_AP            0       // 1 = Enable local AP, 0 = USB Serial only
#define WIFI_AP_SSID              "JalRakshak-Node01"
#define WIFI_AP_PASSWORD          "jalrakshak123" // Min 8 characters
#define WIFI_WEB_PORT             80

#endif // CONFIG_H
