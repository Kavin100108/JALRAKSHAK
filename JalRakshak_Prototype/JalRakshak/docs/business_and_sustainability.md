# JalRakshak Business Model, Sustainability & Social Impact

> [!NOTE]
> **UNVALIDATED PROTOTYPE HYPOTHESIS**  
> All financial figures, pricing models, revenue projections, and operational service estimates presented in this document represent unvalidated preliminary hypotheses for academic and hackathon evaluation. They must be validated through controlled field pilots and local stakeholder engagements.

---

## 1. Intended Users & Stakeholders

JalRakshak is designed as a community-centric technology rather than a direct-to-consumer luxury appliance. Target operational partners include:

1. **Village Water & Sanitation Committees (VWSC / Gram Panchayats):**
   - Responsible for local operation of overhead storage tanks (OHTs) under rural water initiatives (such as the Jal Jeevan Mission).
   - Need low-cost early warning before contaminated water is pumped into community distribution networks.
2. **Rural & Semi-Urban Government Schools and Residential Hostels:**
   - Need continuous protection of rooftop tanks and ground storage reservoirs where student health is directly vulnerable to seasonal water degradation.
3. **Primary Health Centres (PHCs) & Community Clinics:**
   - Need reliable verification that their facility's stored water meets basic clarity and neutral pH requirements.
4. **Water-Focused Grassroots NGOs & Philanthropic Foundations:**
   - Need affordable deployable instrumentation for water crisis monitoring in disaster-affected, flood-prone, or mining-impacted regions.

---

## 2. Indicative Unit Economics & Pricing Hypothesis

### 2.1 Hardware Capital Expenditure (CapEx)
Based on current component market pricing in India (per single node):

| Expense Item | Prototype Cost (Qty: 1) | Small Batch Cost (Qty: 50-100) |
| :--- | :---: | :---: |
| ESP32 DevKit + Power Supply | ₹900 | ₹650 |
| pH, Turbidity, EC, DS18B20 Sensors | ₹4,500 | ₹3,200 |
| Enclosure, Glands, Connectors, Passives | ₹1,200 | ₹800 |
| PCB Fabrication & Assembly (PCBA) | ₹600 | ₹350 |
| **Total Hardware Cost per Node** | **₹7,200** | **₹5,000** |

*Hypothetical Deployment CapEx:* Offered to panchayats or schools at ₹8,500 to ₹10,000 per installed node (covering assembly, testing, hardware bracket, and initial calibration).

### 2.2 Operational Services & Revenue Streams (OpEx)
Hardware deployment is rarely sustainable without ongoing maintenance infrastructure. Potential service streams include:

1. **Installation & Commissioning Fee:**
   - ₹1,500 – ₹2,500 per site: Site assessment, probe mounting, voltage testing, initial two-point buffer calibration, and local operator onboarding.
2. **Annual Maintenance & Calibration Contract (AMC):**
   - ₹3,000 – ₹4,500 per node / year:
     - Monthly probe cleaning and optical inspection.
     - Bi-monthly pH two-point recalibration with fresh standard buffer sachets.
     - Annual probe glass electrode replacement (pH probes degrade over 12–18 months).
3. **Optional Supervisory Monitoring & Report Portal:**
   - ₹250 – ₹400 / node / month: Cloud telemetry aggregation (via cellular gateway or local sync), weekly compliance summaries, and automated SMS incident escalation to block-level engineers.

---

## 3. Scaling Architecture: Single Node to Multi-Source Network

```
+------------------+     +------------------+     +------------------+
| School Node #1   |     | Panchayat OHT #2 |     | Borewell Node #3 |
| (ESP32 Offline)  |     | (ESP32 Offline)  |     | (ESP32 Offline)  |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         +------------------------+------------------------+
                                  |
                [Local Technician Field Tablet / USB Link]
                                  │
                                  ▼
                   +------------------------------+
                   | District Water Dashboard     |
                   | (Telemetry Sync & Incidents) |
                   +------------------------------+
```

### Phased Scaling Strategy:
- **Phase 1 (Single Node - Standalone):** Local buzzer, status LEDs, and USB Web Serial dashboard for local school or pump operator.
- **Phase 2 (Cluster Network - Sub-District / Block Level):** 10 to 20 nodes deployed across one Panchayat. Local service technicians carry a smartphone or tablet running the JalRakshak Web App; connecting via USB OTG or local Wi-Fi AP downloads the latest 30-day offline logs.
- **Phase 3 (Long-Range Mesh / Cellular Integration):** Addition of a low-cost LoRaWAN or 4G LTE-M transceiver to relay alerts to district water management authorities.

---

## 4. Lifecycle, Sensor Degradation & E-Waste Management

Environmental monitoring devices must not themselves become environmental hazards:

1. **pH Electrode Replacement:**
   - The porous ceramic liquid junction and internal silver/silver-chloride reference gel in consumer-grade glass electrodes deplete after 12 to 18 months of continuous immersion.
   - **Strategy:** Standardize on replaceable BNC-connected probes so the main electronic PCB is never discarded when only the disposable probe head reaches end-of-life.
2. **Battery & Solar Disposal:**
   - For solar-powered outdoor nodes, prioritize **Lithium Iron Phosphate ($\text{LiFePO}_4$)** cells over traditional lead-acid or standard Li-ion batteries due to their 2,000+ cycle lifespan, non-combustible thermal stability, and lack of toxic heavy metals.
3. **Modular Enclosure Architecture:**
   - Use reusable IP65 UV-stabilized polycarbonate enclosures that can be serviced in the field by replacing individual modular PCBs without re-drilling or replacing the entire mounting structure.

---

## 5. Measurable Pilot Social Impact Metrics

To prevent unfounded claims (such as premature assertions of "eliminating waterborne illnesses"), future field pilots should measure tangible, verifiable operational indicators:

1. **Early Contamination Warnings Delivered:**
   - Number of anomalous turbidity or pH events flagged prior to morning water distribution.
2. **Response & Remediation Latency:**
   - Time elapsed between automated warning trigger $\rightarrow$ operator review $\rightarrow$ corrective physical verification $\rightarrow$ incident resolution.
3. **Uptime & Offline Data Continuity:**
   - Percentage of days with complete 24/7 continuous sensor readings recorded without data gaps during power or network outages.
4. **Maintenance Compliance Rate:**
   - Percentage of scheduled sensor cleaning and calibration cycles completed on schedule by community operators.
5. **False Alarm vs Verified Anomaly Ratio:**
   - Quantitative evaluation of algorithmic debouncing efficiency against lab-confirmed water degradation.
