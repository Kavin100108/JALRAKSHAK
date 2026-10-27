# JalRakshak Scientific & Regulatory Limitations

> [!CAUTION]
> **MANDATORY SCIENTIFIC DISCLAIMER**  
> JalRakshak is an open-source educational, research, and early-warning monitoring prototype. It is **NOT** a certified water potability instrument. It does **NOT** guarantee that water is safe for human consumption, nor can it detect all environmental contaminants. Sensor data must always be verified by accredited laboratory testing.

---

## 1. What JalRakshak CAN and CANNOT Detect

| Parameter / Hazard | Detectable by JalRakshak? | Technical Explanation |
| :--- | :---: | :--- |
| **Gross Sediment / Silt Influx** | ✅ **YES** | Measured via nephelometric optical turbidity (light scatter). |
| **Acidic or Alkaline Influx** | ✅ **YES** | Measured via glass combination pH electrode. |
| **High Dissolved Mineral Influx** | ✅ **YES** | Measured via electrical conductivity (EC / TDS). |
| **Temperature Shifts** | ✅ **YES** | Measured via digital DS18B20 stainless probe. |
| **Microbiological Pathogens** (*E. coli*, Coliforms, *Vibrio cholerae*, Giardia, Viruses) | ❌ **NO** | Pathogens are microscopic biological organisms ($\approx 0.5 - 5\ \mu\text{m}$) present at low physical mass. They do not alter gross pH or bulk conductivity, and optical turbidity cannot differentiate sterile particles from live bacteria. |
| **Toxic Heavy Metals** (Arsenic, Lead, Mercury, Cadmium, Chromium-6) | ❌ **NO** | Heavy metals are toxic at parts-per-billion ($\mu\text{g/L}$) concentrations. Typical EC sensors only register changes at parts-per-million ($\text{mg/L}$) levels. Detection requires Atomic Absorption Spectroscopy (AAS) or ICP-MS. |
| **Pesticides & Herbicides** (DDT, Malathion, Glyphosate) | ❌ **NO** | Organic chemical pollutants are non-ionic or present in trace quantities, requiring Gas Chromatography-Mass Spectrometry (GC-MS). |
| **Fluoride & Nitrate Contamination** | ❌ **NO** | Anions (e.g., $\text{F}^-$, $\text{NO}_3^-$) blend indistinguishably into total electrical conductivity. Ion-selective electrodes (ISE) or spectrophotometric testing are required. |

---

## 2. Regulatory Context: IS 10500:2012 vs. Prototype Monitoring

In India, drinking water potability is legally governed by the **Bureau of Indian Standards IS 10500:2012 (Drinking Water — Specification)**. IS 10500 specifies over 40 distinct physicochemical and bacteriological parameters.

JalRakshak monitors only **four gross screening parameters**:
1. **pH:** IS 10500 acceptable range is $6.5 - 8.5$ (no relaxation).
2. **Turbidity:** IS 10500 acceptable limit is $1.0\text{ NTU}$; permissible limit in the absence of an alternate source is $5.0\text{ NTU}$.
3. **Total Dissolved Solids (TDS via EC):** IS 10500 acceptable limit is $500\text{ mg/L}$ ($\approx 750 - 800\ \mu\text{S/cm}$); permissible limit is $2000\text{ mg/L}$.
4. **Temperature:** Ambient seasonal baseline indicator.

> **Key Takeaway:** An acceptable reading across all 4 JalRakshak parameters indicates that water clarity, ionic concentration, and pH are within nominal operating bands. **It does NOT constitute proof that the water is free from microbial pathogens, neurotoxins, or carcinogenic heavy metals.**

---

## 3. Physical & Environmental Failure Modes

### 3.1 Biofouling & Slime Accumulation
When submerged in community water reservoirs or open borewells for extended periods (several weeks), bacterial biofilms, algae, and mineral scale (calcium carbonate) coat the optical windows of the turbidity sensor and the glass membrane of the pH electrode:
- **Turbidity Error:** Biofilm on the lens causes false high turbidity readings.
- **pH Error:** Scale deposit clogs the porous liquid junction, resulting in sluggish response times and false neutral drift.
- **Remediation:** Physical inspection and chemical cleaning (dilute acid rinse) must be performed every 2 to 4 weeks.

### 3.2 Temperature Dependence & Thermal Lag
Although electrical conductivity is mathematically compensated to $25.0^\circ\text{C}$, rapid temperature swings between the surface water and the submersible temperature sensor body introduce short-term transient measurement errors.

### 3.3 ESP32 ADC Non-Linearity
The internal Analog-to-Digital Converter of the ESP32 exhibits known non-linearities, particularly near the bottom ($0.0 - 0.15\text{V}$) and top ($3.1 - 3.3\text{V}$) of its operating voltage. While the firmware applies multi-point piecewise scaling and multi-sample averaging, readings in extreme voltage ranges have lower resolution than dedicated 16-bit external ADCs (such as ADS1115).

---

## 4. Operational Ethics & Responsible Deployment

1. **Never Make Unverified Safety Declarations:**
   Operators, administrators, and student demonstrators must never inform a community that water is "safe to drink" based solely on JalRakshak readings.
2. **Proper Role as an Early-Warning Triaging Tool:**
   JalRakshak serves as a continuous **early-warning sentinel**:
   - If turbidity spikes from $0.8\text{ NTU} \rightarrow 12.0\text{ NTU}$ at 2:00 AM, the system warns the pump operator to suspend distribution before muddy water reaches household taps.
   - If pH plummets to $5.6$, the system alerts the operator to investigate upstream pipe leaching or chemical contamination.
3. **Mandatory Laboratory Triaging:**
   Whenever JalRakshak triggers a `CRITICAL` alert, the mandated standard operating procedure (SOP) requires taking an immediate grab sample and dispatching it to a NABL-accredited district water-testing laboratory for full bacteriological and chemical assay.
