/**
 * Invoice configuration types
 */

export type ScheduleType =
  | 'bi-weekly-sunday'    // Every other Sunday
  | 'weekly-sunday'       // Every Sunday
  | 'monthly-first'       // First day of month
  | 'monthly-last'        // Last day of month
  | 'custom'              // Custom cron-like schedule

export interface InvoiceConfig {
  /** Unique identifier for this invoice configuration */
  id: string

  /** Display name */
  name: string

  /** Customer/client name */
  customer: string

  /** Whether this invoice is enabled */
  enabled: boolean

  /** Schedule configuration */
  schedule: {
    /** Type of schedule */
    type: ScheduleType

    /** For bi-weekly schedules, the first date to start from */
    startDate?: string // YYYY-MM-DD

    /** Custom cron expression (if type is 'custom') */
    cron?: string
  }

  /** Email configuration */
  email: {
    /** Primary recipients */
    to: string[]

    /** CC recipients */
    cc?: string[]

    /** BCC recipients */
    bcc?: string[]

    /** Subject line template (can use {{startDate}}, {{endDate}}, {{customer}}) */
    subject?: string

    /** From name */
    fromName?: string
  }

  /** Git repository configuration */
  git: {
    /** Repository paths (supports wildcards) */
    repos: string[]

    /** Number of weeks to analyze */
    weeks: number

    /** Hours per week to bill */
    hoursPerWeek: number
  }

  /** Optional custom settings */
  custom?: {
    /** Any additional metadata */
    [key: string]: unknown
  }
}

export interface InvoiceConfigs {
  /** Version of the config file format */
  version: string

  /** List of invoice configurations */
  invoices: InvoiceConfig[]

  /** Global settings */
  global?: {
    /** Default sender email */
    defaultFromEmail?: string

    /** Default BCC for all invoices */
    defaultBcc?: string[]
  }
}
