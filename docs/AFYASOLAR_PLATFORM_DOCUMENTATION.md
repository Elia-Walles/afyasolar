## AfyaSolar Platform — Comprehensive Documentation

This document explains **what the platform is**, **who uses it**, **what it does**, and provides a **database schema reference** (tables and relationships) based on the current implementation.

---

## 1) What AfyaSolar is

AfyaSolar is a web platform for **healthcare-facility energy services**. It combines:

- **Afya Solar**: solar package selection, subscriptions, financing models (cash, installment, energy-as-a-service), and operations tracking.
- **Energy monitoring**: device telemetry, health, alerts, analytics.
- **Microgrid management**: linking a facility solar system to nearby consumers (e.g., staff housing / small businesses) with tariffs, credit balances, and usage billing.
- **Service operations**: installation/maintenance jobs, requests, quotes, proposals, and payments.
- **Additional services** (in the same platform): booking packages, facility communications (bulk SMS), feedback, referrals, and finance-related modules.

---

## 2) Users, roles, and who can do what

The platform supports multiple user types. Each feature describes its primary users.

### Admin users

Admins typically manage:

- Facility onboarding and account support
- Solar package catalogue (packages, plans, pricing, specs)
- Subscriber / contract oversight (cash, installment, EaaS/PaaS)
- Invoice requests and payment verification
- Monitoring dashboards (fleet performance, device alerts)
- Maintenance workflows (plans, requests, proposals, visits, payments)
- Inventory and equipment listings / buybacks / refurbishments
- Notifications and analytics

### Facility users (health facilities)

Facilities typically:

- Access service dashboards (e.g., Afya Solar service dashboard)
- Select solar packages and payment plans
- Request invoices and track pending approvals
- View energy performance summaries (where enabled)
- Submit help requests and service requests
- Manage booking settings (where booking is enabled)

### Facility sub-roles (departmental)

Facility accounts can have sub-roles (e.g., “store manager”, “pharmacy manager”, “finance & administration officer”). Sub-roles are used for **RBAC** and to shape which parts of the facility experience are read-only vs actionable.

### Technicians

Technicians typically:

- Receive and manage service jobs (installation/maintenance/repair)
- Update job status, notes, and maintenance reporting
- Track commissions and withdrawals (where enabled)

### Investor users (optional domain)

Investor dashboards and simulated facility data support “portfolio” views, financial summaries, and scenario analysis (depending on configuration).

### Onboarding (system role)

A dedicated onboarding role supports guided registration / invitations and verification flows.

---

## 3) Major product areas (features & functionality)

### A) Authentication, invitations, and account security

- **Sign up / sign in** for different roles.
- **Email verification** and **verification codes**.
- **Password reset** and account lockout protections (failed login attempts).
- **Invitation flows** for facility users and admins, including resend capability.

Primary users: facility users, admins, technicians.

### B) Facility management

- Facility profiles (address, region/district, contact information).
- Facility branches/stores (organizational structure).
- Facility category, coordinates, logos, and terms acceptance.
- Booking settings (slug, WhatsApp contact, enable/disable).
- Referral code program and referral tracking.

Primary users: admins (setup), facilities (self-management in certain areas).

### C) Afya Solar — packages, plans, pricing, subscriptions

Core capabilities:

- **Package catalogue**: multiple system sizes (standard and scalable), with structured specs.
- **Payment plans** per package:
  - Cash purchase
  - Installment (deposit + monthly payments)
  - Energy-as-a-Service / Power-as-a-Service (monthly service fee, minimum term)
- **Customer package selection** and “proceed to payment” flows.
- **Invoice request flow**: facility can request to pay via invoice; admin can approve/mark as paid.
- **Subscriber tracking**: an operational “subscriber record” that represents the facility’s plan, price, and system status.
- **Contracts**:
  - Installment contracts: total price, duration, upfront amount, generated schedule.
  - EaaS contracts: billing model, monthly fee, minimum term.
- **Service lifecycle**: client service records tie a facility to a package plan and operational status.

Primary users: facilities (selection), admins (catalogue + contracts + oversight).

### D) Afya Solar sizing, assessment, and design reports

Capabilities:

- Energy use assessment inputs (major devices / loads, behavior & management index).
- Indicative system sizing and savings outlook.
- Exportable assessment output (e.g., reports for subscription decision).
- Storage of design report records for admin review and follow-up.

Primary users: facilities (assessment), admins (review, quoting).

### E) Smart metering, telemetry, device health, and alerts

Capabilities:

- Device registry tied to facilities.
- Time-series measurements: voltage/current/power/energy, solar generation, battery metrics, grid status.
- Device health: online status, last seen, maintenance due, error/warning counts.
- Alerts: severity, codes, acknowledgements, resolutions, notification channels.
- Aggregated analytics: hourly/daily/monthly performance and CO2 avoided/savings metrics.

Primary users: admins, facilities (dashboard views).

### F) Microgrid management (facility export + consumers)

Capabilities:

- Define a microgrid facility linked to a primary facility.
- Configure export capacity and tariffs (price per kWh and optional peak/off-peak).
- Register microgrid consumers (households/businesses), their meters, credit balances, and status.
- Record usage and compute costs; track payment status for usage.

Primary users: admins (setup), operations teams (billing/credit), facilities (visibility depending on permissions).

### G) Payments and transaction tracking

Capabilities:

- Payment initiation and callbacks via mobile money providers (provider abstraction via gateway).
- Transaction history and status tracking.
- Service-access payments (one-time payments required for access to a service).
- Subscription payments (recurring payments for subscriptions).
- Verification and reconciliation tools for admins.

Primary users: facilities (pay), admins (verify/reconcile).

### H) Maintenance services (plans, requests, proposals, visits)

Capabilities:

- Maintenance plan catalogue and facility plan enrollment.
- Maintenance plan requests, proposals (with proposal items), approvals, and visit scheduling.
- Status history tracking for auditability.
- Payments for maintenance plans and visits.
- Maintenance requests + quotes + quote items + reports + reviews.
- Comment threads and audit logs for collaboration.

Primary users: facilities (request), admins (approve/manage), technicians (execute).

### I) Equipment / inventory / refurbishments

Capabilities:

- Facility equipment registry.
- Admin equipment listings and photos.
- Equipment buyback requests and photos.
- Refurbishment jobs and technician↔admin comments.
- Resale inventory and spare parts.
- Part orders lifecycle.

Primary users: admins, technicians; facilities for equipment context.

### J) Booking / clinic operations (Afya Booking domain)

Capabilities:

- Booking packages (tiers, pricing, included features, bulk SMS allowances).
- Medical departments, doctors, time slots.
- Patients and appointments.
- AI intake summaries for visits.
- Feedback collection after appointment.

Primary users: facilities, admins (package management).

### K) Communications, notifications, analytics, and feedback

Capabilities:

- Communication logs.
- Facility notifications and admin notifications.
- Push notification subscriptions (PWA).
- Public analytics event capture (visits).
- Facility feedback and feature request intake.

Primary users: admins; facilities for feedback.

### L) Finance domain (Afya Finance)

Capabilities (platform-level):

- Product catalogue, pools, pool participants.
- Orders and credit applications / accounts.
- Emergency requests.
- Mini-warehouses and inventory.
- Hub requests and facility sales.

Primary users: admins, finance staff, facilities depending on access.

---

## 4) Core workflows (end-to-end)

### Workflow 1: Facility onboarding → access services

1. Facility is created (admin or self-registration depending on configuration).
2. Facility verifies identity (verification code/email) and accepts terms.
3. Facility gains access to services page and dashboards per enabled services.

### Workflow 2: Afya Solar package selection → payment plan → activation

1. Facility selects a package and payment plan (cash / installment / PaaS).
2. Facility pays directly OR requests an invoice (invoice request is tracked).
3. Admin verifies/marks payment status (or approves invoice route).
4. Subscriber record becomes active; service records track installation and system status.

### Workflow 3: Installment contract creation (admin) → schedule → billing

1. Admin creates installment contract with total price, duration, and upfront amount.
2. System generates an installment schedule (upfront + monthly periods).
3. Payments are recorded and reconciled against expected schedule.

### Workflow 4: EaaS/PaaS contract creation (admin) → monthly billing

1. Admin creates an EaaS contract with billing model and monthly fee.
2. Minimum term is enforced as per commercial policy.
3. Monthly billing events and payments are tracked; service status may be automated.

### Workflow 5: Monitoring & alerts → maintenance actions

1. Telemetry arrives (polling or ingestion).
2. Health and alert rules generate alerts; alerts are acknowledged/resolved.
3. Maintenance jobs/requests are created, assigned, and executed by technicians.

### Workflow 6: Microgrid consumer billing

1. Microgrid tariff is configured for a facility.
2. Consumers are registered and linked to meters (optional).
3. Usage records are generated; costs computed.
4. Payments/credit top-ups update balances and payment status.

---

## 5) Database schema reference (tables & relationships)

This section describes the **entire schema surface** as defined in the platform schemas.

### 5.1 Identity & access

- **`users`**: primary authentication users (role, facilityId, subRole, verification + reset fields).
- **`admins`**: admin identities (some deployments keep this separate from `users`).
- **`verification_codes`**: short codes for verification (email, expiry, used).

Relationships:

- `users.facility_id` → `facilities.id` (optional; only for facility-linked users).

### 5.2 Facility core data

- **`facilities`**: master facility record (region/district, booking settings, referral program, service status fields).
- **`facility_branches`**: branches under a facility.
- **`facility_stores`**: stores under a facility.
- **`regions`**, **`districts`**: location reference data.

Relationships:

- `facility_branches.facility_id` → `facilities.id`
- `facility_stores.facility_id` → `facilities.id`
- `facilities.region_id` → `regions.id` (nullable)
- `facilities.district_id` → `districts.id` (nullable)

### 5.3 Devices & energy measurements (core)

- **`devices`**: device registry (facility association, type, status).
- **`energy_data`**: time-series energy data per device (voltage/current/power/energy, balances, generation).

Relationships:

- `devices.facility_id` → `facilities.id`
- `energy_data.device_id` → `devices.id`

### 5.4 Telemetry domain (monitoring, health, alerts, analytics)

- **`device_telemetry`**: detailed telemetry metrics per device and time.
- **`device_health`**: aggregated health state per device.
- **`device_alerts`**: alerts generated for devices and facilities.
- **`device_performance_analytics`**: aggregated analytics by time period.
- **`contracts`**: generic contracts table (separate from Afya Solar domain contracts).

Relationships:

- Each telemetry/health/alert row has `device_id` + `facility_id` linking to `devices` and `facilities`.

### 5.5 Payments & billing (general platform)

- **`payments`**: general payment records (facility, method, status, transaction ID).
- **`bills`**: billing records for consumption/cost periods.
- **`payment_transactions`**: detailed transaction tracking (status and reconciliation).
- **`transaction_status_history`**: audit trail of transaction status changes.
- **`service_access_payments`**: one-time payments required to unlock a service (can store selected package metadata).
- **`service_subscriptions`**: subscriptions to platform services (status, plan type, billing).
- **`subscription_payments`**: payments tied to service subscriptions.
- **`push_subscriptions`**: browser/device push subscriptions for notifications.

Relationships:

- Most payment tables reference `facility_id` → `facilities.id`.

### 5.6 Afya Solar domain (packages, services, contracts, metering, microgrid)

Package catalogue:

- **`afyasolar_packages`**: package list (code, name, rated kW, active).
- **`afyasolar_package_specs`**: package specs (panels, battery, inverter, output, warranty).
- **`afyasolar_plan_types`**: plan type registry (CASH, INSTALLMENT, EAAS).
- **`afyasolar_plans`**: plans per package (type, currency, active).
- **`afyasolar_plan_pricing`**: pricing per plan (cash price, installment configuration, EAAS fee, inclusion flags, effective window).

Service subscription & lifecycle:

- **`afyasolar_client_services`**: facility + selected package plan + operational status; can link to a smart meter.
- **`afyasolar_service_status_history`**: status changes (who/why/when).
- **`afyasolar_service_plan_changes`**: plan changes effective dates.

Afya Solar contracts:

- **`afyasolar_installment_contracts`**: installment contract details.
- **`afyasolar_installment_schedule`**: per-period schedule with due dates and amounts.
- **`afyasolar_eaas_contracts`**: EAAS/PaaS contracts (billing model, monthly fee, minimum term).

Afya Solar metering & control:

- **`afyasolar_smartmeters`**: smart meter registry (serial, vendor, endpoint, last seen).
- **`afyasolar_meter_commands`**: queued commands to meters (relay control and similar).
- **`afyasolar_meter_readings`**: meter readings (V/I/P/E, relay status, credit balance, raw payload).
- **`afyasolar_relay_actions`**: log of relay on/off actions and results.

Microgrid:

- **`afyasolar_facility_tariffs`**: facility tariffs (kWh price, peak/off-peak, connection fees).
- **`afyasolar_microgrid_facilities`**: microgrid facility definitions (export capacity, tariff).
- **`afyasolar_microgrid_consumers`**: consumers connected to microgrid (balances, status, optional meter).
- **`afyasolar_microgrid_usage_records`**: usage events (kWh, cost, payment status).

Design and assessment:

- **`afyasolar_design_reports`**: stored sizing/financial reports for a facility (metrics + JSON payload).

Central subscriber record:

- **`afyasolar_subscribers`**: consolidated “subscriber state” for Afya Solar (facility info, package info, plan type, payment status, system status, billing, history arrays).

Key relationships (high-level):

- Package chain: `afyasolar_packages` → `afyasolar_package_specs` (1:0..1), `afyasolar_plans` (1:N) → `afyasolar_plan_pricing` (1:0..1 per plan/pricing version).
- Client service chain: `afyasolar_client_services.facility_id` → `facilities.id`; `package_id` → `afyasolar_packages.id`; `plan_id` → `afyasolar_plans.id`; `smartmeter_id` → `afyasolar_smartmeters.id` (optional).
- Contract chain: installment/EAAS contracts reference `afyasolar_client_services.id` (1:0..1 each type).
- Schedule chain: `afyasolar_installment_schedule.installment_contract_id` → `afyasolar_installment_contracts.id` (1:N).
- Meter readings/commands/actions link to `afyasolar_smartmeters.id` and optionally `afyasolar_client_services.id`.
- Microgrid chain: `afyasolar_microgrid_facilities.facility_id` → `facilities.id`; `tariff_id` → `afyasolar_facility_tariffs.id`; consumers reference `microgrid_facility_id`.

### 5.7 Maintenance domain

Plans and enrollment:

- **`maintenance_plans`**
- **`facility_maintenance_plans`**
- **`maintenance_plan_visits`**

Requests and approvals:

- **`maintenance_plan_requests`**
- **`maintenance_plan_request_equipment`**
- **`maintenance_plan_proposals`**
- **`maintenance_plan_proposal_items`**
- **`maintenance_plan_payments`**
- **`maintenance_plan_status_history`**

Service requests:

- **`maintenance_requests`**
- **`maintenance_quotes`**
- **`maintenance_quote_items`**
- **`maintenance_reports`**
- **`maintenance_reviews`**
- **`maintenance_request_comments`**
- **`maintenance_audit_logs`**

Relationships:

- Most maintenance tables reference `facility_id` → `facilities.id`.
- Technician assignments reference `technicians.id` where applicable.

### 5.8 Technician domain

- **`technicians`**: technician identity/profile.
- **`service_jobs`**: jobs can reference `technician_id`.
- **`technician_commissions`**
- **`technician_withdrawals`**

### 5.9 Equipment, parts, resale, refurbishment

- **`equipment_categories`**
- **`facility_equipment`**
- **`equipment_buybacks`**, **`equipment_buyback_photos`**
- **`refurbishment_jobs`**, **`refurbishment_job_comments`**
- **`admin_equipment_listings`**, **`admin_equipment_photos`**
- **`resale_inventory`**
- **`spare_parts`**
- **`part_orders`**

### 5.10 Booking / clinic operations

- **`afya_booking_packages`**
- **`afya_booking_invoice_requests`**
- **`departments`**
- **`doctors`**
- **`doctor_time_slots`**
- **`patients`**
- **`insurance_providers`**
- **`insurance_coverages`**
- **`appointments`**
- **`visits`**
- **`ai_intake_summaries`**
- **`facility_feedback`**

### 5.11 Communications, requests, referrals, and notifications

- **`communication_logs`**
- **`help_requests`**
- **`device_requests`**
- **`feature_requests`**
- **`facility_referrals`**
- **`facility_notifications`**
- **`admin_notifications`**

### 5.12 Efficiency & climate resilience

- **`facility_efficiency_daily`**: daily rollups, performance ratio, underperformance flags.
- **`facility_climate_profile`**: hazard risk scores and resilience score.
- **`facility_climate_adaptation`**: recommendations and implementation tracking.
- **`facility_resilience_snapshot`**: monthly resilience trend.

### 5.13 Simulated / demo data

- **`simulated_facilities`**
- **`simulated_facility_monthly_metrics`**
- **`simulated_payments`**

### 5.14 External reference catalogues (TMDA) and finance domain

- **`tmda_medical_equipment_consumables`**
- **`tmda_pharmaceutical_products`**
- **Afya Finance tables**:
  - `afya_finance_products`
  - `afya_finance_pools`
  - `afya_finance_pool_participants`
  - `afya_finance_orders`
  - `afya_finance_credit_applications`
  - `afya_finance_credit_accounts`
  - `afya_finance_emergency_requests`
  - `afya_finance_mini_warehouses`
  - `afya_finance_inventory`
  - `afya_finance_hub_requests`
  - `afya_finance_facility_sales`

---

## 6) Non-functional behavior, constraints, and limitations

From the current architecture constraints:

- Some smart-meter functionality is cloud-dependent, with polling cadence constraints (not real-time streaming).
- Certain advanced features (offline mode, dual relay, critical load protection) may be intentionally out of scope depending on the meter vendor capabilities.

---

## 7) Where to extend next (recommended documentation add-ons)

If you want this document to be even more operationally useful, the next sections to add are:

- A “**Screenshots / UI tour**” section (per role).
- A “**Runbook**” (support procedures: payment disputes, device offline, invoice approval, contract changes).
- A “**Data dictionary**” appendix (per table: all columns, types, enums, and constraints).

