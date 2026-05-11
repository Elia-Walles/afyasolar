/**
 * PAYG & Financing queries.
 *
 * The accounting platform v2 owns the schema (`accounting_financing_contracts`
 * and `accounting_repayment_entries`); this module reads/writes those tables
 * via raw SQL so we don't need to mirror them into Drizzle here.
 *
 * Every facility-side helper enforces ownership by joining/filtering on
 * `customer_id = facilities.id` (a contract's `customer_id` is the facility id).
 */

import { getRawConnection } from '@/lib/db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface FinancingContract {
  id: string
  customerId: string
  principalIssued: string
  interestRate: string
  amountPaid: string
  outstandingBalance: string
  daysOverdue: number
  provisionForDefaults: string
  status: 'active' | 'completed' | 'defaulted'
  createdAt: Date
  updatedAt: Date
}

export interface RepaymentEntry {
  id: string
  contractId: string
  dueDate: Date
  amount: string
  principal: string
  interest: string
  status: 'pending' | 'paid' | 'overdue'
  paidDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FacilityScheduleRow extends RepaymentEntry {
  facilityId: string
}

export async function getFacilityContracts(facilityId: string): Promise<FinancingContract[]> {
  const connection = getRawConnection()
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,
            customer_id        AS customerId,
            principal_issued   AS principalIssued,
            interest_rate      AS interestRate,
            amount_paid        AS amountPaid,
            outstanding_balance AS outstandingBalance,
            days_overdue       AS daysOverdue,
            provision_for_defaults AS provisionForDefaults,
            status,
            created_at         AS createdAt,
            updated_at         AS updatedAt
       FROM accounting_financing_contracts
      WHERE customer_id = ?
   ORDER BY created_at DESC`,
    [facilityId],
  )
  return rows as unknown as FinancingContract[]
}

export async function getContractForFacility(
  contractId: string,
  facilityId: string,
): Promise<FinancingContract | null> {
  const connection = getRawConnection()
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,
            customer_id        AS customerId,
            principal_issued   AS principalIssued,
            interest_rate      AS interestRate,
            amount_paid        AS amountPaid,
            outstanding_balance AS outstandingBalance,
            days_overdue       AS daysOverdue,
            provision_for_defaults AS provisionForDefaults,
            status,
            created_at         AS createdAt,
            updated_at         AS updatedAt
       FROM accounting_financing_contracts
      WHERE id = ? AND customer_id = ?
      LIMIT 1`,
    [contractId, facilityId],
  )
  return (rows[0] as unknown as FinancingContract) || null
}

export async function getFacilityRepaymentSchedule(facilityId: string): Promise<FacilityScheduleRow[]> {
  const connection = getRawConnection()
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT r.id,
            r.contract_id  AS contractId,
            r.due_date     AS dueDate,
            r.amount,
            r.principal,
            r.interest,
            r.status,
            r.paid_date    AS paidDate,
            r.created_at   AS createdAt,
            r.updated_at   AS updatedAt,
            c.customer_id  AS facilityId
       FROM accounting_repayment_entries r
       JOIN accounting_financing_contracts c ON c.id = r.contract_id
      WHERE c.customer_id = ?
   ORDER BY r.due_date ASC`,
    [facilityId],
  )
  return rows as unknown as FacilityScheduleRow[]
}

export async function getNextPendingEntry(contractId: string): Promise<RepaymentEntry | null> {
  const connection = getRawConnection()
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,
            contract_id    AS contractId,
            due_date       AS dueDate,
            amount,
            principal,
            interest,
            status,
            paid_date      AS paidDate,
            created_at     AS createdAt,
            updated_at     AS updatedAt
       FROM accounting_repayment_entries
      WHERE contract_id = ? AND status <> 'paid'
   ORDER BY due_date ASC
      LIMIT 1`,
    [contractId],
  )
  return (rows[0] as unknown as RepaymentEntry) || null
}

/**
 * Atomically apply a successful repayment to the financing contract and
 * its schedule. Re-reads contract state inside the transaction so we
 * never trust the caller's amount blindly.
 *
 * Modes:
 *  - "installment": marks the targetEntryId pending entry as paid; reduces
 *    outstanding by the supplied amount (already validated server-side).
 *  - "full":        marks ALL pending entries as paid; reduces outstanding
 *    by the supplied amount and forces it to 0 if it would go negative;
 *    flips contract status to "completed".
 *
 * Also recomputes the owning facility's `status` (active / low_credit) and
 * `credit_balance` based on remaining outstanding across all contracts.
 */
export async function applyPayment(args: {
  contractId: string
  amount: number
  mode: 'installment' | 'full'
  targetEntryId?: string | null
}): Promise<{
  contractId: string
  newAmountPaid: number
  newOutstandingBalance: number
  newStatus: 'active' | 'completed' | 'defaulted'
  appliedEntries: number
}> {
  const pool = getRawConnection()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [contractRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, customer_id AS customerId,
              principal_issued AS principalIssued,
              amount_paid AS amountPaid,
              outstanding_balance AS outstandingBalance,
              status
         FROM accounting_financing_contracts
        WHERE id = ?
        FOR UPDATE`,
      [args.contractId],
    )
    const contract = contractRows[0]
    if (!contract) {
      throw new Error(`Contract ${args.contractId} not found`)
    }

    const currentPaid = Number(contract.amountPaid) || 0
    const currentOutstanding = Number(contract.outstandingBalance) || 0
    const amount = Number(args.amount) || 0
    if (amount <= 0) throw new Error('Amount must be > 0')

    const newAmountPaid = +(currentPaid + amount).toFixed(2)
    const newOutstanding = +Math.max(0, currentOutstanding - amount).toFixed(2)

    let appliedEntries = 0
    if (args.mode === 'installment') {
      if (!args.targetEntryId) throw new Error('targetEntryId required for installment mode')
      const [r] = await conn.query<ResultSetHeader>(
        `UPDATE accounting_repayment_entries
            SET status = 'paid',
                paid_date = NOW()
          WHERE id = ? AND contract_id = ? AND status <> 'paid'`,
        [args.targetEntryId, args.contractId],
      )
      appliedEntries = r.affectedRows
    } else {
      const [r] = await conn.query<ResultSetHeader>(
        `UPDATE accounting_repayment_entries
            SET status = 'paid',
                paid_date = NOW()
          WHERE contract_id = ? AND status <> 'paid'`,
        [args.contractId],
      )
      appliedEntries = r.affectedRows
    }

    const newStatus: 'active' | 'completed' | 'defaulted' =
      newOutstanding <= 0 ? 'completed' : (contract.status as 'active' | 'completed' | 'defaulted')

    await conn.query(
      `UPDATE accounting_financing_contracts
          SET amount_paid = ?,
              outstanding_balance = ?,
              status = ?,
              days_overdue = CASE WHEN ? <= 0 THEN 0 ELSE days_overdue END
        WHERE id = ?`,
      [
        newAmountPaid.toFixed(2),
        newOutstanding.toFixed(2),
        newStatus,
        newOutstanding,
        args.contractId,
      ],
    )

    // Refresh facility-level status & credit_balance.
    const facilityId = String(contract.customerId)
    const [aggRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(outstanding_balance), 0) AS totalOutstanding,
              COALESCE(MAX(days_overdue), 0)        AS maxOverdue
         FROM accounting_financing_contracts
        WHERE customer_id = ? AND status = 'active'`,
      [facilityId],
    )
    const totalOutstanding = Number(aggRows[0]?.totalOutstanding ?? 0)
    const maxOverdue = Number(aggRows[0]?.maxOverdue ?? 0)

    const facilityStatus =
      maxOverdue >= 30 ? 'low_credit' : 'active'

    await conn.query(
      `UPDATE facilities
          SET credit_balance = ?,
              status = CASE
                        WHEN status = 'suspended' THEN status
                        ELSE ?
                      END
        WHERE id = ?`,
      [totalOutstanding.toFixed(2), facilityStatus, facilityId],
    )

    await conn.commit()

    return {
      contractId: args.contractId,
      newAmountPaid,
      newOutstandingBalance: newOutstanding,
      newStatus,
      appliedEntries,
    }
  } catch (err) {
    try { await conn.rollback() } catch { /* ignore */ }
    throw err
  } finally {
    conn.release()
  }
}
