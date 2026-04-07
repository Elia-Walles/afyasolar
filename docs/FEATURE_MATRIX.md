# AfyaSolar feature matrix (design → working app)

This file maps what exists in `D:\ubuntu\afya-solar-system-design` (design/guidelines/prototype) to the implementation in `D:\ubuntu\afyasolar` (working system), and highlights what is **missing** and will be implemented.

## Routes (UI)

### Demo token dashboards (design repo)
- **Design**:
  - `app/demo/[token]/page.tsx`
  - `app/demo/facility/[token]/page.tsx`
  - `app/demo/microgrid/[token]/page.tsx`
- **Working app today**: **Missing** (no `src/app/demo/**` routes)
- **Plan implementation**:
  - `src/app/demo/[token]/page.tsx`
  - `src/app/demo/facility/[token]/page.tsx`
  - `src/app/demo/microgrid/[token]/page.tsx`
  - plus shared demo data module `src/lib/facility-data.ts`

## APIs

### Payments: `/api/payments/mpesa` (design repo)
- **Design**:
  - `app/api/payments/mpesa/route.ts`
  - `app/api/payments/mpesa/callback/route.ts`
- **Working app today**:
  - Uses **AzamPay** endpoints:
    - `src/app/api/payments/azam-pay/initiate/route.ts`
    - `src/app/api/payments/azam-pay/callback/route.ts`
  - AzamPay supports provider value `Mpesa` via `src/lib/payments/azam-pay.ts`
- **Implementation approach**:
  - Add the design-compatible endpoints under `src/app/api/payments/mpesa/**`
  - Implement them as **wrappers** that call into the existing AzamPay flow (provider `Mpesa`)

### Smart meter data/control: `/api/meters/[deviceId]/*` (design repo)
- **Design**:
  - `GET app/api/meters/[deviceId]/data/route.ts`
  - `POST app/api/meters/[deviceId]/control/route.ts` with `{ action: "on" | "off" }`
- **Working app today**:
  - Smart meter admin CRUD exists:
    - `src/app/api/afya-solar/smartmeters/route.ts`
  - Command queue table exists:
    - `src/lib/db/afya-solar-schema.ts` → `afyasolar_meter_commands`
- **Implementation approach**:
  - Add the design-compatible endpoints under `src/app/api/meters/[deviceId]/*`
  - Map `deviceId` to `afyasolar_smartmeters` by `meter_serial` (string ID) first; fall back to numeric smartmeter `id` if needed.
  - Use `afyasolar_meter_commands` (and new audit tables) for relay-control requests.

## Libraries / modules

### Microgrid manager (design repo)
- **Design**: `lib/microgrid-manager.ts`
- **Working app today**: **Missing** as a module (no `microgrid` domain services)
- **Plan implementation**:
  - Add `src/lib/microgrid/microgrid-manager.ts` as a server-safe module (pure business logic + dependency injection).

### Demo facility seed data (design repo)
- **Design**: `lib/facility-data.ts`
- **Working app today**: **Missing**
- **Plan implementation**:
  - Add `src/lib/facility-data.ts` (ported)

## Database (AfyaSolar domain)

### Existing relevant AfyaSolar tables in working app
Defined in `src/lib/db/afya-solar-schema.ts`:
- `afyasolar_smartmeters`
- `afyasolar_meter_commands`
- `afyasolar_client_services`
- `afyasolar_packages`, `afyasolar_plans`, pricing/specs

### Missing tables implied by the design repo
Not currently present in `src/lib/db/afya-solar-schema.ts` and will be added:
- `afyasolar_microgrid_facilities`
- `afyasolar_microgrid_consumers`
- `afyasolar_microgrid_usage_records`
- `afyasolar_facility_tariffs`
- `afyasolar_meter_readings`
- `afyasolar_relay_actions`

