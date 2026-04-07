# AfyaSolar Simplified System Architecture

## Overview

Cloud-dependent system using manufacturer's REST API with 30-second polling and M-Pesa payments only.

## Removed Features

The following features have been removed as they are not supported by the manufacturer's smart meter:

1. **Dual Relay System** - Only single relay control available
2. **Critical Load Protection** - Cannot protect vaccine fridges independently
3. **Real-time MQTT** - Using 30-second REST API polling instead
4. **Offline Capability** - Requires constant internet connection
5. **Edge Box/Local Server** - Cloud-only architecture
6. **SMS Fallback** - No SMS integration available
7. **5-second Updates** - Limited to 30-second polling
8. **Local Data Storage** - All data stored in cloud only
9. **Offline Queue** - No queuing for offline operations

## Supported Features

### M-Pesa Payments Only

- STK Push integration
- Automatic credit top-up
- Payment verification
- Transaction history

### Cloud Monitoring

- 30-second polling interval
- Voltage, current, power readings
- Energy consumption tracking
- Credit balance monitoring

### Single Relay Control

- Remote on/off control
- Cloud-based management
- All loads disconnect together (no critical load protection)

## Architecture

```
Healthcare Facility
└── Smart Meter (Single Relay)
    └── Internet Required

Cloud Platform
├── Next.js Application
├── Smart Meter API Integration
├── M-Pesa Payment Gateway
└── Supabase Database
```

## Requirements

- Constant 4G/3G internet connection
- M-Pesa mobile money account
- Cloud access for all operations
- No offline capability

## Limitations

- Cannot operate without internet
- No critical load protection
- 30-second minimum refresh rate
- Single relay only (all loads together)
- M-Pesa payments only

