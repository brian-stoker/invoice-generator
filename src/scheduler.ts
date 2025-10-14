#!/usr/bin/env node

import { generateInvoiceFromConfig } from './invoice-generator'
import { sendInvoiceEmailFromConfig } from './email-sender'
import { getConfigsToRunToday } from './config-loader'
import { format } from 'date-fns'
import * as fs from 'fs'
import * as path from 'path'

const LOG_FILE = path.join(__dirname, '../invoice-scheduler.log')

function log(message: string) {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  const logMessage = `[${timestamp}] ${message}\n`

  console.log(logMessage)
  fs.appendFileSync(LOG_FILE, logMessage)
}

async function runScheduledInvoice() {
  log('Starting scheduled invoice checker...')

  try {
    const today = new Date()
    log(`Today: ${format(today, 'EEEE, MMMM d, yyyy')}`)

    // Get all configs that should run today
    const configsToRun = getConfigsToRunToday(today)

    if (configsToRun.length === 0) {
      log('No invoices scheduled for today')
      return
    }

    log(`Found ${configsToRun.length} invoice(s) to generate`)

    // Process each config
    for (const config of configsToRun) {
      try {
        log(`\n--- Processing invoice: ${config.name} (${config.id}) ---`)

        // Generate invoice
        log('Generating invoice...')
        const invoiceData = await generateInvoiceFromConfig({
          config,
          verbose: true
        })

        if (!invoiceData) {
          log(`ERROR: Failed to generate invoice for ${config.id}`)
          continue
        }

        log('Invoice generated successfully')
        log(`  Customer: ${invoiceData.customer}`)
        log(`  Period: ${invoiceData.startDate} - ${invoiceData.endDate}`)
        log(`  Total Hours: ${invoiceData.totalHours}`)

        // Send email
        log('Sending invoice email...')
        const emailResult = await sendInvoiceEmailFromConfig({
          config,
          ...invoiceData,
          testMode: false,
          verbose: true
        })

        if (emailResult.success) {
          log(`✓ Invoice email sent successfully for ${config.id}!`)
        } else {
          log(`✗ ERROR: Failed to send email for ${config.id}: ${emailResult.error}`)
        }

      } catch (error) {
        log(`ERROR processing ${config.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    log('\n=== Scheduler run completed ===')

  } catch (error) {
    log(`FATAL ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  runScheduledInvoice()
}