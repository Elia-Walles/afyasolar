# AfyaSolar Carbon Calculator Methodology & Standards Compliance

This document describes the carbon calculator methodology used by AfyaSolar and the standards it aims to align with.

> Source: Ported from the design repo (`afya-solar-system-design/docs/CARBON_CALCULATOR_METHODOLOGY.md`).

## Core calculation

**Grid emission factor (Tanzania)**: 0.7 kg CO2 per kWh

```
CO2 kg Avoided = Solar Generation kWh × 0.7 kg CO2/kWh
Carbon Credits (tons) = CO2 kg Avoided ÷ 1,000
Market Value USD = Carbon Credits (tons) × $15 USD/ton
Market Value TSh = Market Value USD × 2,500
```

## Notes

- Data is expected from smart meters (polling-based telemetry) and aggregated by time period (monthly/annual).
- This repo already includes carbon/efficiency dashboards; this file serves as the methodology reference for reporting and audits.

