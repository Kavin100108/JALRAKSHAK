# JalRakshak Hardware Assembly & Wiring Guide

This document provides complete, practical hardware instructions for assembling the **JalRakshak** water-quality monitoring node, including component selection, bill of materials (with INR price ranges), pin assignments, electrical isolation, and pre-hardware simulation.

---

## 1. Bill of Materials (BOM) & Indicative Pricing

The prototype is engineered to remain well within an accessible **₹5,000 to ₹15,000** budget for colleges, panchayats, and community makers.

| Component | Indicative Specification | Qty | Price Range (INR) | Sourcing Notes |
| :--- | :--- | :---: | :---: | :--- |
| **ESP32 DevKit Board** | ESP-WROOM-32 (30-pin or 38-pin), Micro-USB | 1 | ₹450 – ₹650 | Standard NodeMCU-32S / ESP32-WROOM |
| **pH Sensor Module** | Analog pH-4502C signal board + BNC glass probe | 1 | ₹1,600 – ₹2,400 | Includes signal conditioning board & BNC probe |
| **Turbidity Sensor** | Optical turbidity module (TS-300B / Gravity type) | 1 | ₹800 – ₹1,400 | Infrared optical transmitter/receiver pair |
| **EC / TDS Sensor** | Analog Electrical Conductivity meter module & probe | 1 | ₹900 – ₹1,800 | Titanium probe pins; includes AC driver PCB |
| **Temperature Sensor**| DS18B20 waterproof stainless steel probe (1m cable)| 1 | ₹180 – ₹350 | Digital 1-Wire sensor (requires 4.7kΩ pull-up) |
| **OLED Display** | 0.96" SSD1306 I2C 128x64 display (Blue/White) | 1 | ₹250 – ₹450 | Optional local read-out |
| **MicroSD Card Module**| SPI MicroSD breakout board + 8GB/16GB card | 1 | ₹280 – ₹500 | Formatted to FAT32 for offline storage |
| **Status LEDs & Resistors**| 5mm LEDs (Green, Yellow, Red) + 330Ω resistors | 3 ea| ₹30 – ₹60 | Current limiting 330Ω per LED |
| **Active Buzzer** | 3.3V / 5V Active piezo buzzer module | 1 | ₹40 – ₹90 | Audible alarm signaling |
| **Resistors & Capacitors**| 4.7kΩ, 10kΩ, 20kΩ 1/4W resistors, 100nF, 10µF caps | 1 set| ₹50 – ₹100 | Voltage dividers & ADC power decoupling |
| **Regulated Power Supply**| 5V 2.0A Micro-USB adapter / DC buck converter | 1 | ₹250 – ₹500 | Clean DC power supply essential for low ADC noise |
| **Enclosure & Glands**| IP65 Weatherproof junction box + PG7/PG9 cable glands | 1 | ₹400 – ₹800 | PVC enclosure with rubber gasket |
| **Breadboard / Perfboard**| High-quality solderless breadboard or prototyping PCB | 1 | ₹150 – ₹350 | Prototyping interconnects |
| **Total Indicative Cost**| **Complete Single-Node Hardware Package** | | **₹5,150 – ₹9,450** | **Comfortably under ₹15,000 ceiling** |

---

## 2. Complete ESP32 Pin Mapping & Conflict Analysis

```
                      +-------------------+
                      |   ESP32 DevKit    |
               3.3V --| 3V3           GND |-- GND (Common Star Ground)
                 EN --| EN             23 |-- SPI MOSI (MicroSD)
     (pH) ADC1_CH6 --| 34             22 |-- I2C SCL (OLED Display)
(Turbidity) ADC1_CH7 -| 35             21 |-- I2C SDA (OLED Display)
(Conductivity) ADC1_4-| 32             19 |-- SPI MISO (MicroSD)
                      | 33             18 |-- SPI SCK (MicroSD)
                      | 25              5 |-- SPI CS (MicroSD)
      Green LED Normal-| 25             17 |-- 
     Yellow LED Warning| 26             16 |-- 
      Red LED Critical-| 27              4 |-- 1-Wire Data (DS18B20 Temp)
          Active Buzzer| 14              2 |-- 
                 5V --| VIN             0 |-- 
                      +-------------------+
```

### Critical Hardware Rules & Conflict Checks:
1. **ADC1 vs ADC2 Isolation:**
   - **Rule:** Never map analog sensors to ADC2 pins (GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, 27).
   - **Reason:** The ESP32's ADC2 peripheral shares internal silicon resources with the Wi-Fi and Bluetooth radio. Whenever Wi-Fi is active, ADC2 analog reads fail and return corrupted values.
   - **Implementation:** All analog probes are assigned strictly to **ADC1**:
     - pH $\rightarrow$ `GPIO 34` (ADC1_CH6)
     - Turbidity $\rightarrow$ `GPIO 35` (ADC1_CH7)
     - EC $\rightarrow$ `GPIO 32` (ADC1_CH4)
2. **Input-Only Pins:**
   - `GPIO 34` and `GPIO 35` are physical input-only pins without internal pull-up/pull-down resistors. This makes them ideal for high-impedance analog sensor inputs.
3. **Boot Strapping Pins:**
   - Pins `GPIO 0`, `GPIO 2`, `GPIO 12`, and `GPIO 15` control ESP32 bootloader modes. None of these pins are used for sensor inputs, avoiding inadvertent boot hangs.

---

## 3. Sensor Wiring Tables & Circuits

### 3.1 pH Sensor Module (pH-4502C)
| Sensor Board Pin | Connection | Notes |
| :--- | :--- | :--- |
| **VCC** | 5V (VIN) | Module requires 5V to power internal op-amps. |
| **GND** | GND | Connect to common star ground. |
| **Po (Analog Out)**| Voltage Divider $\rightarrow$ GPIO 34 | Scaled to $\le 3.3\text{V}$ (see divider below). |
| **Do (Digital Out)**| Not Connected | Internal comparator threshold not used. |
| **To (Temp Out)** | Not Connected | Built-in thermistor is uncalibrated; DS18B20 used instead. |

> **⚠️ Voltage Scaling Circuit for pH:**
> Connect a $10\text{k}\Omega$ resistor from `Po` to `GPIO 34`, and a $20\text{k}\Omega$ resistor from `GPIO 34` to `GND`. This scales a $0 - 5.0\text{V}$ swing down to a safe $0 - 3.33\text{V}$ range, protecting the ESP32 silicon.

### 3.2 Turbidity Sensor Module (Optical)
| Sensor Board Pin | Connection | Notes |
| :--- | :--- | :--- |
| **VCC** | 5V (VIN) | Infrared LED requires 5V for optical emission. |
| **GND** | GND | Common ground. |
| **AOUT (Analog Out)**| Voltage Divider $\rightarrow$ GPIO 35 | Pure water yields $\approx 4.1\text{V}$ without divider. |

> **⚠️ Voltage Scaling Circuit for Turbidity:**
> Connect $10\text{k}\Omega$ between `AOUT` and `GPIO 35`, and $20\text{k}\Omega$ between `GPIO 35` and `GND` (Ratio: $2/3$, scaling $4.2\text{V} \rightarrow 2.8\text{V}$).

### 3.3 EC / TDS Sensor Module
| Sensor Board Pin | Connection | Notes |
| :--- | :--- | :--- |
| **VCC** | 3.3V or 5V | Powers AC square wave oscillator. |
| **GND** | GND | Common ground. |
| **AOUT** | GPIO 32 | Typically outputs $0 - 2.3\text{V}$ (safe for 3.3V ADC). |

### 3.4 DS18B20 Waterproof Temperature Sensor
| Cable Wire Color | Signal | Connection |
| :--- | :--- | :--- |
| **Red** | VCC | Connect to 3.3V rail. |
| **Black** | GND | Connect to Common Ground. |
| **Yellow / Blue** | Data (1-Wire) | Connect to **GPIO 4** with a **4.7kΩ pull-up resistor to 3.3V**. |

### 3.5 Status Actuators & Display
| Peripheral | Pin | Connection Details |
| :--- | :--- | :--- |
| **Normal LED (Green)** | GPIO 25 | Pin $\rightarrow$ $330\Omega$ resistor $\rightarrow$ Anode (+); Cathode (-) $\rightarrow$ GND |
| **Warning LED (Yellow)**| GPIO 26 | Pin $\rightarrow$ $330\Omega$ resistor $\rightarrow$ Anode (+); Cathode (-) $\rightarrow$ GND |
| **Critical LED (Red)** | GPIO 27 | Pin $\rightarrow$ $330\Omega$ resistor $\rightarrow$ Anode (+); Cathode (-) $\rightarrow$ GND |
| **Active Buzzer** | GPIO 14 | Positive (+) $\rightarrow$ GPIO 14; Negative (-) $\rightarrow$ GND |
| **OLED SDA** | GPIO 21 | Connect to Display SDA |
| **OLED SCL** | GPIO 22 | Connect to Display SCL |
| **OLED VCC & GND** | 3.3V & GND | SSD1306 operates natively on 3.3V |

---

## 4. Electrical Safety, Noise & Grounding Precautions

1. **Galvanic Interference (The Multi-Probe Water Bath Effect):**
   - **The Phenomenon:** When an EC probe (which injects an alternating AC excitation current into the liquid) and a high-impedance glass pH probe are submerged simultaneously in the same conductive water tank, electrical leakage currents flow through the water into the pH reference electrode. This causes massive voltage erraticism (spikes of $\pm 2.0\text{ pH}$).
   - **Mitigation in Hardware:**
     - Maintain at least **$10\text{cm}$ to $15\text{cm}$ physical separation** between the EC probe pins and the pH glass bulb.
     - Ensure the power supply is isolated from mains earth ground loops.
     - For industrial field nodes, an optical/galvanic analog isolator IC (e.g. ISO1540 or dedicated isolated DC-DC converter like B0505S) is recommended.
2. **Single-Point "Star" Grounding:**
   - Analog return currents must not share long thin ground traces with pulsing digital peripherals (like the OLED or MicroSD card). Run a central star ground bus directly to the ESP32 GND pin.
3. **Power Decoupling:**
   - Place a $10\mu\text{F}$ electrolytic capacitor in parallel with a $100\text{nF}$ ceramic capacitor across the $3.3\text{V}$ and $\text{GND}$ rails close to the ESP32 to eliminate ADC ripple.

---

## 5. Physical Waterproofing & Enclosure Guidelines

1. **Enclosure Rating:** Use an **IP65 or IP66** rated polycarbonate or ABS electrical junction box ($160\text{mm} \times 110\text{mm} \times 70\text{mm}$) with a silicone sealing gasket.
2. **Cable Entry:** Drill holes only on the **bottom face** of the enclosure. Fit threaded nylon cable glands (**PG7 for sensor wires, PG9 for main power**) with rubber compression collars to prevent water tracking.
3. **Drip Loops:** Bend every external cable into a downward "drip loop" before it enters the gland, ensuring rainwater flows downward away from the seal.
4. **Submergence Limitations:**
   - **DS18B20:** The stainless-steel probe head is fully waterproof; however, ensure the PVC heat-shrink joint is sealed with marine adhesive heat-shrink tubing if submerged deeper than $1\text{m}$.
   - **Turbidity Sensor Head:** The black plastic optical clip is submersible, but the **small adapter amplifier PCB is NOT waterproof** and must remain dry inside the enclosure!
   - **pH Glass Probe:** The glass bulb must remain wet in storage solution (3M KCl) when not deployed. Never let the bulb dry out.

---

## 6. Pre-Hardware Simulation Guide

You do not need physical sensors to develop and test JalRakshak!

### Method A: Potentiometer Hardware Simulation
Before your sensors arrive in the mail, simulate all 3 analog sensors on a breadboard using $10\text{k}\Omega$ potentiometers:
1. Connect Potentiometer Leg 1 to `GND`, Leg 3 to `3.3V`.
2. Connect Wiper (Leg 2) of Potentiometer 1 to `GPIO 34` (simulates pH $0 - 14$).
3. Connect Wiper of Potentiometer 2 to `GPIO 35` (simulates Turbidity).
4. Connect Wiper of Potentiometer 3 to `GPIO 32` (simulates Conductivity).
5. Turning the dials lets you inject faults, test debouncing, and verify LED/buzzer actions in real time!

### Method B: Online Wokwi Simulation
The firmware can be simulated on [Wokwi.com](https://wokwi.com) for ESP32 by placing an ESP32 board, three potentiometers, three LEDs, a buzzer, and an SSD1306 OLED display using the exact pin mappings defined in `config.example.h`.

### Method C: Software Test Bench (Immediate)
Use the included **JalRakshak Dashboard** in **Simulated Live Stream Mode** (`dashboard/index.html`). The built-in interactive test bench allows you to test the complete detection pipeline and verification workflow with a single click.
