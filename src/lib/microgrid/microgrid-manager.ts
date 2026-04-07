export interface MicrogridConsumer {
  consumerId: string
  name: string
  type: 'staff_housing' | 'household' | 'community' | 'nearby_business'
  meterId: string
  phoneNumber: string
  address: string
  tariffRate: number // TSh per kWh
  creditBalance: number
  status: 'active' | 'suspended' | 'disconnected'
  connectionDate: string
  lastPayment: string
  totalConsumption: number // kWh lifetime
  monthlyConsumption: number // kWh this month
  outstandingBalance: number // TSh owed
}

export interface MicrogridFacility {
  facilityId: string
  facilityName: string
  totalConsumers: number
  activeConsumers: number
  totalExportCapacity: number // kW available to sell
  currentExportPower: number // kW being exported now
  monthlyRevenue: number // TSh earned this month
  totalRevenue: number // TSh lifetime
  tariffRate: number // TSh per kWh (facility sets this)
  consumers: MicrogridConsumer[]
}

export interface UsageRecord {
  consumerId: string
  timestamp: string
  energy: number // kWh consumed
  cost: number // TSh charged
  paymentStatus: 'paid' | 'pending' | 'overdue'
}

export interface MicrogridMetrics {
  totalFacilities: number
  totalConsumers: number
  totalExportedEnergy: number // kWh
  totalRevenue: number // TSh
  averageTariff: number // TSh/kWh
  facilitiesWithMicrogrid: MicrogridFacility[]
}

export interface MicrogridRelayController {
  setRelay: (meterId: string, action: 'on' | 'off') => Promise<void>
}

/**
 * Server-safe microgrid business logic.
 * - Pure logic + in-memory state (for now)
 * - External side effects (relay control) are injected via `MicrogridRelayController`
 */
export class MicrogridManager {
  private facilities: Map<string, MicrogridFacility> = new Map()
  private usageRecords: Map<string, UsageRecord[]> = new Map()

  constructor(private relayController: MicrogridRelayController) {}

  async initializeMicrogrid(
    facilityId: string,
    facilityName: string,
    exportCapacity: number,
    tariffRate = 500,
  ): Promise<MicrogridFacility> {
    const facility: MicrogridFacility = {
      facilityId,
      facilityName,
      totalConsumers: 0,
      activeConsumers: 0,
      totalExportCapacity: exportCapacity,
      currentExportPower: 0,
      monthlyRevenue: 0,
      totalRevenue: 0,
      tariffRate,
      consumers: [],
    }

    this.facilities.set(facilityId, facility)
    return facility
  }

  async addConsumer(
    facilityId: string,
    consumer: Omit<
      MicrogridConsumer,
      'consumerId' | 'status' | 'totalConsumption' | 'monthlyConsumption' | 'outstandingBalance' | 'lastPayment'
    >,
  ): Promise<MicrogridConsumer> {
    const facility = this.facilities.get(facilityId)
    if (!facility) throw new Error('Facility not found')

    const consumerId = `CONS-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    const newConsumer: MicrogridConsumer = {
      ...consumer,
      consumerId,
      status: 'active',
      totalConsumption: 0,
      monthlyConsumption: 0,
      outstandingBalance: 0,
      lastPayment: new Date().toISOString(),
    }

    facility.consumers.push(newConsumer)
    facility.totalConsumers++
    facility.activeConsumers++
    return newConsumer
  }

  async trackConsumption(facilityId: string, consumerId: string, energyConsumed: number): Promise<void> {
    const facility = this.facilities.get(facilityId)
    if (!facility) return

    const consumer = facility.consumers.find((c) => c.consumerId === consumerId)
    if (!consumer) return

    const cost = energyConsumed * facility.tariffRate

    consumer.totalConsumption += energyConsumed
    consumer.monthlyConsumption += energyConsumed
    consumer.creditBalance -= cost

    if (consumer.creditBalance < 0) {
      consumer.outstandingBalance = Math.abs(consumer.creditBalance)
      consumer.creditBalance = 0
    }

    facility.monthlyRevenue += cost
    facility.totalRevenue += cost

    const record: UsageRecord = {
      consumerId,
      timestamp: new Date().toISOString(),
      energy: energyConsumed,
      cost,
      paymentStatus: consumer.outstandingBalance > 0 ? 'pending' : 'paid',
    }

    if (!this.usageRecords.has(consumerId)) this.usageRecords.set(consumerId, [])
    this.usageRecords.get(consumerId)!.push(record)

    if (consumer.outstandingBalance > 10000 && consumer.status === 'active') {
      await this.disconnectConsumer(facilityId, consumerId, 'outstanding_balance')
    }
  }

  async processConsumerPayment(
    facilityId: string,
    consumerId: string,
    amount: number,
    _mpesaTransactionId: string,
  ): Promise<void> {
    const facility = this.facilities.get(facilityId)
    if (!facility) throw new Error('Facility not found')

    const consumer = facility.consumers.find((c) => c.consumerId === consumerId)
    if (!consumer) throw new Error('Consumer not found')

    consumer.creditBalance += amount
    consumer.lastPayment = new Date().toISOString()

    if (consumer.outstandingBalance > 0) {
      if (amount >= consumer.outstandingBalance) {
        consumer.creditBalance = amount - consumer.outstandingBalance
        consumer.outstandingBalance = 0
      } else {
        consumer.outstandingBalance -= amount
        consumer.creditBalance = 0
      }
    }

    if (consumer.status === 'suspended' && consumer.outstandingBalance === 0) {
      await this.reconnectConsumer(facilityId, consumerId)
    }
  }

  async disconnectConsumer(
    facilityId: string,
    consumerId: string,
    _reason: 'outstanding_balance' | 'manual' | 'maintenance',
  ): Promise<void> {
    const facility = this.facilities.get(facilityId)
    if (!facility) return

    const consumer = facility.consumers.find((c) => c.consumerId === consumerId)
    if (!consumer) return

    await this.relayController.setRelay(consumer.meterId, 'off')
    consumer.status = 'suspended'
    facility.activeConsumers = Math.max(0, facility.activeConsumers - 1)
  }

  async reconnectConsumer(facilityId: string, consumerId: string): Promise<void> {
    const facility = this.facilities.get(facilityId)
    if (!facility) return

    const consumer = facility.consumers.find((c) => c.consumerId === consumerId)
    if (!consumer) return

    await this.relayController.setRelay(consumer.meterId, 'on')
    consumer.status = 'active'
    facility.activeConsumers++
  }

  updateTariffRate(facilityId: string, newRate: number): void {
    const facility = this.facilities.get(facilityId)
    if (!facility) return
    facility.tariffRate = newRate
  }

  getMicrogridStatus(facilityId: string): MicrogridFacility | null {
    return this.facilities.get(facilityId) || null
  }

  getConsumer(facilityId: string, consumerId: string): MicrogridConsumer | null {
    const facility = this.facilities.get(facilityId)
    if (!facility) return null
    return facility.consumers.find((c) => c.consumerId === consumerId) || null
  }

  getUsageHistory(consumerId: string, days = 30): UsageRecord[] {
    const records = this.usageRecords.get(consumerId) || []
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return records.filter((r) => new Date(r.timestamp).getTime() > cutoff)
  }

  getMicrogridMetrics(): MicrogridMetrics {
    let totalConsumers = 0
    let totalExportedEnergy = 0
    let totalRevenue = 0
    let totalTariff = 0
    let facilityCount = 0

    const facilitiesWithMicrogrid: MicrogridFacility[] = []

    this.facilities.forEach((facility) => {
      totalConsumers += facility.totalConsumers
      totalRevenue += facility.totalRevenue
      totalTariff += facility.tariffRate
      facilityCount++

      facility.consumers.forEach((consumer) => {
        totalExportedEnergy += consumer.totalConsumption
      })

      facilitiesWithMicrogrid.push(facility)
    })

    return {
      totalFacilities: facilityCount,
      totalConsumers,
      totalExportedEnergy,
      totalRevenue,
      averageTariff: facilityCount > 0 ? totalTariff / facilityCount : 0,
      facilitiesWithMicrogrid,
    }
  }
}

