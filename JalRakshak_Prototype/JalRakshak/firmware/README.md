# JalRakshak Firmware Guide

This directory contains the production-ready C++ firmware for the **JalRakshak** water quality monitoring node, written for the **ESP32** microcontroller using the Arduino core.

---

## 1. Hardware Architecture & Pin Map

| Function | ESP32 Pin | Type | Notes |
| :--- | :--- | :--- | :--- |
| **pH Sensor** | GPIO 34 | Analog In (ADC1_CH6) | Input-only pin. Requires 0–3.3V scaled output. |
| **Turbidity Sensor** | GPIO 35 | Analog In (ADC1_CH7) | Input-only pin. Check module output voltage! |
| **EC / TDS Sensor** | GPIO 32 | Analog In (ADC1_CH4) | Calibrated for 25°C temperature compensation. |
| **DS18B20 Temp** | GPIO 4 | Digital 1-Wire | Requires 4.7kΩ pull-up resistor to 3.3V. |
| **Green LED (Normal)** | GPIO 25 | Digital Out | Active HIGH. |
| **Yellow LED (Warning)**| GPIO 26 | Digital Out | Active HIGH. |
| **Red LED (Critical)** | GPIO 27 | Digital Out | Active HIGH. |
| **Buzzer** | GPIO 14 | Digital Out | Active/Piezo buzzer. |
| **OLED SDA** | GPIO 21 | I2C Data | Optional 0.96" SSD1306 (address 0x3C). |
| **OLED SCL** | GPIO 22 | I2C Clock | Optional 0.96" SSD1306. |
| **MicroSD CS** | GPIO 5 | SPI Chip Select | Optional offline storage. |
| **MicroSD MOSI** | GPIO 23 | SPI MOSI | Optional offline storage. |
| **MicroSD MISO** | GPIO 19 | SPI MISO | Optional offline storage. |
| **MicroSD SCK** | GPIO 18 | SPI Clock | Optional offline storage. |

> **IMPORTANT ADC SAFETY RULE:** All analog sensors are mapped strictly to **ADC1** pins (GPIO 32, 34, 35). In the ESP32, ADC2 cannot be used concurrently with Wi-Fi or Bluetooth. Connecting analog sensors to ADC2 pins leads to severe reading corruption whenever wireless features are active.

---

## 2. Prerequisites & Arduino IDE Setup

### Step 1: Install Arduino IDE
Download and install **Arduino IDE 2.x** from [arduino.cc](https://www.arduino.cc/en/software).

### Step 2: Add ESP32 Board Package
1. In Arduino IDE, open **File > Preferences**.
2. In **Additional boards manager URLs**, add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools > Board > Boards Manager...**, search for `esp32` by **Espressif Systems**, and click **Install**.

### Step 3: Install Required Libraries
Open **Tools > Manage Libraries...** and install the latest versions of:
- `OneWire` by Jim Studt, Paul Stoffregen
- `DallasTemperature` by Miles Burton
- `Adafruit SSD1306` by Adafruit
- `Adafruit GFX Library` by Adafruit

---

## 3. Configuration

1. In this directory, make a copy of `config.example.h` and rename it to `config.h`:
   ```powershell
   Copy-Item config.example.h config.h
   ```
2. Open `config.h` to customize:
   - Calibration slopes and intercepts (`PH_CALIBRATION_SLOPE`, `TURB_CALIBRATION_SLOPE`, etc.)
   - Alert thresholds (`PH_WARN_LOW`, `TURB_CRIT_HIGH`, etc.)
   - Device identifier (`DEVICE_ID`)
   - Wi-Fi Access Point mode toggle (`ENABLE_WIFI_AP`)

*Note: `config.h` is excluded by `.gitignore` to prevent leaking network credentials.*

---

## 4. Compiling and Flashing

1. Connect your ESP32 board to your computer via micro-USB.
2. Select your board under **Tools > Board > esp32 > ESP32 Dev Module**.
3. Select the active COM port under **Tools > Port**.
4. Configure upload parameters:
   - **Upload Speed:** `921600` (or `115200` if upload fails)
   - **CPU Frequency:** `240MHz`
   - **Flash Frequency:** `80MHz`
   - **Flash Mode:** `QIO`
5. Click **Verify** (checkmark icon) to compile.
6. Click **Upload** (arrow icon). If your board gets stuck at `Connecting......._____`, press and hold the physical **BOOT** button on the ESP32 until the upload progress appears.

---

## 5. Serial Monitor Output

Open **Tools > Serial Monitor** and set the baud rate to **115200**.

You will see real-time JSON frames emitted every 2 seconds:
```json
{
  "deviceId": "JR-NODE-01",
  "uptime": 24,
  "sample": 12,
  "readings": {
    "ph": 7.21,
    "turbidity": 1.15,
    "ec": 365.2,
    "temperature": 24.50
  },
  "rawVolts": {
    "ph": 1.454,
    "turbidity": 2.821,
    "ec": 0.365
  },
  "health": {
    "ph": "OK",
    "turbidity": "OK",
    "ec": "OK",
    "temperature": "OK"
  },
  "status": {
    "overall": "NORMAL",
    "alerts": "NONE"
  }
}
```

This clean JSON stream connects directly to the JalRakshak browser dashboard via the **Web Serial API**.

---

## 6. Graceful Peripheral Degradation

The firmware is designed with defensive fault tolerance:
- **No OLED display?** The firmware detects absence of an I2C ACK and runs normally without freezing.
- **No MicroSD card?** It automatically falls back to internal SPIFFS flash storage.
- **Disconnected probe?** Detects open-circuit ADC or DS18B20 `-127.0°C` signature, categorizes it as `HEALTH_DISCONNECTED`, illuminates the Red LED with a fault tone, but **does not crash or misclassify it as chemical contamination**.
