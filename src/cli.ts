#!/usr/bin/env node

import { Command } from 'commander'
import { generateInvoice, generateInvoiceFromConfig } from './invoice-generator'
import { sendInvoiceEmail, sendInvoiceEmailFromConfig } from './email-sender'
import { loadConfigs, getConfigById } from './config-loader'
import chalk from 'chalk'
import { format } from 'date-fns'

const program = new Command()

program
  .name('invoice')
  .description('Generate and send invoices based on git commit history')
  .version('2.0.0')

// Legacy command - direct customer name
program
  .command('legacy <customer>')
  .description('Generate invoice using legacy customer name lookup (deprecated)')
  .option('-t, --test', 'Test mode - only send to b@stokedconsulting.com')
  .option('-w, --weeks <number>', 'Number of weeks to include (default: 2)', '2')
  .option('-s, --start-date <date>', 'Start date (YYYY-MM-DD)')
  .option('-e, --end-date <date>', 'End date (YYYY-MM-DD)')
  .option('-d, --dry-run', 'Generate invoice without sending email')
  .option('-v, --verbose', 'Verbose output')
  .action(async (customer, options) => {
    try {
      console.log(chalk.blue(`🚀 Generating invoice for ${customer}...`))

      // Generate the invoice
      const invoiceData = await generateInvoice({
        customer,
        weeks: parseInt(options.weeks),
        startDate: options.startDate,
        endDate: options.endDate,
        verbose: options.verbose
      })

      if (!invoiceData) {
        console.error(chalk.red('Failed to generate invoice'))
        process.exit(1)
      }

      console.log(chalk.green('\n✅ Invoice generated successfully!\n'))
      console.log(chalk.gray('─'.repeat(60)))
      console.log(invoiceData.text)
      console.log(chalk.gray('─'.repeat(60)))

      if (options.dryRun) {
        console.log(chalk.yellow('\n📋 Dry run mode - email not sent'))
        return
      }

      // Send the email
      console.log(chalk.blue('\n📧 Sending invoice email...'))

      const emailResult = await sendInvoiceEmail({
        ...invoiceData,
        testMode: options.test,
        verbose: options.verbose
      })

      if (emailResult.success) {
        console.log(chalk.green(`✅ Invoice email sent successfully!`))
        if (options.test) {
          console.log(chalk.yellow('Test mode: Only sent to b@stokedconsulting.com'))
        }
      } else {
        console.error(chalk.red(`❌ Failed to send email: ${emailResult.error}`))
        process.exit(1)
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error)
      process.exit(1)
    }
  })

// New config-based command (default)
program
  .argument('[config-id]', 'Invoice configuration ID (from invoice-configs.json). If not provided, lists available configs.')
  .option('-t, --test', 'Test mode - only send to b@stokedconsulting.com')
  .option('-d, --dry-run', 'Generate invoice without sending email')
  .option('-v, --verbose', 'Verbose output')
  .option('-l, --list', 'List all available invoice configurations')
  .action(async (configId, options) => {
    try {
      const configs = loadConfigs()

      // List mode
      if (options.list || !configId) {
        console.log(chalk.blue('\n📋 Available Invoice Configurations:\n'))
        configs.invoices.forEach(config => {
          const status = config.enabled ? chalk.green('✓ enabled') : chalk.gray('✗ disabled')
          console.log(`  ${chalk.bold(config.id)} - ${config.name}`)
          console.log(`    Customer: ${config.customer}`)
          console.log(`    Schedule: ${config.schedule.type}`)
          console.log(`    Status: ${status}`)
          console.log()
        })
        return
      }

      // Find the config
      const config = getConfigById(configId)
      if (!config) {
        console.error(chalk.red(`❌ Configuration '${configId}' not found`))
        console.log(chalk.yellow('\nAvailable configurations:'))
        configs.invoices.forEach(c => console.log(`  - ${c.id}`))
        process.exit(1)
      }

      console.log(chalk.blue(`🚀 Generating invoice: ${config.name}`))
      console.log(chalk.gray(`   Customer: ${config.customer}`))
      console.log(chalk.gray(`   Schedule: ${config.schedule.type}\n`))

      // Generate the invoice
      const invoiceData = await generateInvoiceFromConfig({
        config,
        verbose: options.verbose
      })

      if (!invoiceData) {
        console.error(chalk.red('Failed to generate invoice'))
        process.exit(1)
      }

      console.log(chalk.green('\n✅ Invoice generated successfully!\n'))
      console.log(chalk.gray('─'.repeat(60)))
      console.log(invoiceData.text)
      console.log(chalk.gray('─'.repeat(60)))

      if (options.dryRun) {
        console.log(chalk.yellow('\n📋 Dry run mode - email not sent'))
        return
      }

      // Send the email
      console.log(chalk.blue('\n📧 Sending invoice email...'))

      const emailResult = await sendInvoiceEmailFromConfig({
        config,
        ...invoiceData,
        testMode: options.test,
        verbose: options.verbose
      })

      if (emailResult.success) {
        console.log(chalk.green(`✅ Invoice email sent successfully!`))
        if (options.test) {
          console.log(chalk.yellow('Test mode: Only sent to b@stokedconsulting.com'))
        }
      } else {
        console.error(chalk.red(`❌ Failed to send email: ${emailResult.error}`))
        process.exit(1)
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error)
      process.exit(1)
    }
  })

program.parse()