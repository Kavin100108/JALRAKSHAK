"""
Unit Tests for JalRakshak Anomaly Detection & Debouncing Logic
File: test_anomaly_detection.py
"""

import unittest
from jalrakshak_core import ThresholdConfig, SensorReading, JalRakshakDetector


class TestAnomalyDetection(unittest.TestCase):
    def setUp(self):
        self.config = ThresholdConfig(debounce_cycles=3)
        self.detector = JalRakshakDetector(self.config)

    def test_nominal_baseline_readings(self):
        """Verifies that clean baseline values result in NORMAL status and no active alerts."""
        nominal = SensorReading(ph=7.24, turbidity_ntu=0.82, ec_us_cm=325.0, temperature_c=24.5)
        severity, alerts = self.detector.evaluate_cycle(nominal)
        self.assertEqual(severity, "NORMAL")
        self.assertEqual(len(alerts), 0)

    def test_ph_warning_low_and_high(self):
        """Tests warning-level deviations for pH (< 6.5 or > 8.5)."""
        # Sustained low pH warning
        low_ph = SensorReading(ph=6.30, turbidity_ntu=0.80, ec_us_cm=320.0, temperature_c=24.0)
        for _ in range(self.config.debounce_cycles):
            severity, alerts = self.detector.evaluate_cycle(low_ph)

        self.assertEqual(severity, "WARNING")
        self.assertIn("WARN_PH_LOW", alerts)

        # Reset detector
        detector_high = JalRakshakDetector(self.config)
        high_ph = SensorReading(ph=8.75, turbidity_ntu=0.80, ec_us_cm=320.0, temperature_c=24.0)
        for _ in range(self.config.debounce_cycles):
            severity, alerts = detector_high.evaluate_cycle(high_ph)

        self.assertEqual(severity, "WARNING")
        self.assertIn("WARN_PH_HIGH", alerts)

    def test_turbidity_critical_spike(self):
        """Tests that turbidity >= 10.0 NTU triggers CRITICAL severity."""
        muddy = SensorReading(ph=7.10, turbidity_ntu=14.5, ec_us_cm=340.0, temperature_c=25.0)
        for _ in range(self.config.debounce_cycles):
            severity, alerts = self.detector.evaluate_cycle(muddy)

        self.assertEqual(severity, "CRITICAL")
        self.assertIn("CRIT_TURBIDITY", alerts)

    def test_ec_critical_spike(self):
        """Tests that EC >= 1500 uS/cm triggers CRIT_EC_SPIKE."""
        saline = SensorReading(ph=7.20, turbidity_ntu=0.90, ec_us_cm=1650.0, temperature_c=24.5)
        for _ in range(self.config.debounce_cycles):
            severity, alerts = self.detector.evaluate_cycle(saline)

        self.assertEqual(severity, "CRITICAL")
        self.assertIn("CRIT_EC_SPIKE", alerts)

    def test_hysteresis_debouncing(self):
        """Verifies that an electrical transient spike of 1 or 2 cycles does not flap the alarm."""
        spike = SensorReading(ph=7.20, turbidity_ntu=15.0, ec_us_cm=320.0, temperature_c=24.0)
        nominal = SensorReading(ph=7.20, turbidity_ntu=0.80, ec_us_cm=320.0, temperature_c=24.0)

        # Cycle 1 of spike: should remain NORMAL
        sev1, _ = self.detector.evaluate_cycle(spike)
        self.assertEqual(sev1, "NORMAL", "Single cycle transient must be filtered out.")

        # Cycle 2 of spike: should still remain NORMAL (requires 3 cycles)
        sev2, _ = self.detector.evaluate_cycle(spike)
        self.assertEqual(sev2, "NORMAL", "Two cycles transient must be filtered out.")

        # Cycle 3: Sustained spike triggers alarm
        sev3, alerts = self.detector.evaluate_cycle(spike)
        self.assertEqual(sev3, "CRITICAL")
        self.assertIn("CRIT_TURBIDITY", alerts)

    def test_recovery_to_baseline(self):
        """Verifies that after an anomaly clears, status smoothly transitions back to NORMAL."""
        spike = SensorReading(ph=7.20, turbidity_ntu=15.0, ec_us_cm=320.0, temperature_c=24.0)
        nominal = SensorReading(ph=7.20, turbidity_ntu=0.80, ec_us_cm=320.0, temperature_c=24.0)

        # Trigger critical state
        for _ in range(3):
            self.detector.evaluate_cycle(spike)
        self.assertEqual(self.detector.current_severity, "CRITICAL")

        # Now feed normal readings: status decrements and recovers
        self.detector.evaluate_cycle(nominal)
        self.detector.evaluate_cycle(nominal)
        sev_rec, alerts_rec = self.detector.evaluate_cycle(nominal)

        self.assertEqual(sev_rec, "NORMAL")
        self.assertEqual(len(alerts_rec), 0)

    def test_multi_parameter_simultaneous_anomalies(self):
        """Tests detection when both pH and Turbidity breach limits at the same time."""
        compound = SensorReading(ph=5.80, turbidity_ntu=12.0, ec_us_cm=310.0, temperature_c=24.0)
        for _ in range(3):
            severity, alerts = self.detector.evaluate_cycle(compound)

        self.assertEqual(severity, "CRITICAL")
        self.assertIn("CRIT_PH_ACIDIC", alerts)
        self.assertIn("CRIT_TURBIDITY", alerts)


if __name__ == "__main__":
    unittest.main()
