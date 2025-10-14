import nodemailer from 'nodemailer'
import { format } from 'date-fns'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { InvoiceConfig } from './types/config'

// Load environment variables
const envPath = path.join(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

interface EmailOptions {
  customer: string
  startDate: string
  endDate: string
  text: string
  totalHours: number
  testMode?: boolean
  verbose?: boolean
  recipients?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  fromName?: string
}

interface EmailOptionsFromConfig {
  config: InvoiceConfig
  startDate: string
  endDate: string
  text: string
  totalHours: number
  testMode?: boolean
  verbose?: boolean
}

interface EmailResult {
  success: boolean
  error?: string
}

export async function sendInvoiceEmail(options: EmailOptions): Promise<EmailResult> {
  const { customer, startDate, endDate, text, totalHours, testMode, verbose } = options

  // Gmail configuration
  const gmailUser = process.env.GMAIL_USER || 'b@stokedconsulting.com'
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  if (!gmailPass) {
    return {
      success: false,
      error: 'Gmail app password not configured. Please set GMAIL_APP_PASSWORD in .env file'
    }
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  })

  // Prepare recipients (can be overridden by options)
  let recipients: string[]
  let ccRecipients: string[] = []
  let bccRecipients: string[] = ['b@stokedconsulting.com']

  if (testMode) {
    recipients = ['b@stokedconsulting.com']
    bccRecipients = []
  } else if (options.recipients) {
    // Use provided recipients
    recipients = options.recipients
    ccRecipients = options.cc || []
    bccRecipients = options.bcc || ['b@stokedconsulting.com']
  } else {
    // Fallback to defaults
    recipients = [
      'brianstoker+tony@gmail.com',
      'brianstoker+chris@gmail.com'
    ]
    ccRecipients = [
      'brianstoker@gmail.com'
    ]
  }

  // Format email content
  const subject = options.subject || `Brian Stoker Invoice from ${startDate} - ${endDate}`
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #2c3e50;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .invoice-details {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .work-summary {
      margin: 20px 0;
    }
    .week-header {
      font-weight: bold;
      color: #2c3e50;
      margin-top: 15px;
      margin-bottom: 10px;
      font-size: 16px;
    }
    .task-item {
      margin-left: 20px;
      margin-bottom: 5px;
    }
    .footer {
      border-top: 1px solid #ddd;
      margin-top: 30px;
      padding-top: 20px;
      color: #666;
      font-size: 14px;
    }
    .total-hours {
      font-weight: bold;
      color: #27ae60;
      font-size: 18px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Invoice - Stoked Consulting</h2>
    <p><strong>Brian Stoker</strong><br>
    b@stokedconsulting.com</p>
  </div>
  
  <div class="invoice-details">
    <p><strong>Client:</strong> ${customer.charAt(0).toUpperCase() + customer.slice(1)}</p>
    <p><strong>Invoice Period:</strong> ${startDate} - ${endDate}</p>
    <p><strong>Invoice Date:</strong> ${format(new Date(), 'MMMM d, yyyy')}</p>
  </div>
  
  <div class="work-summary">
    <h3>Work Summary</h3>
    ${formatHtmlWork(text)}
    
    <div class="total-hours">
      Total Hours: ${totalHours}
    </div>
  </div>
  
  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Please remit payment within 30 days.</p>
    <p><small>This invoice was automatically generated based on git commit history.</small></p>
  </div>
</body>
</html>
  `
  
  const fromName = options.fromName || 'Brian Stoker'

  const mailOptions = {
    from: `"${fromName}" <${gmailUser}>`,
    to: recipients.join(', '),
    cc: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
    bcc: bccRecipients.length > 0 ? bccRecipients.join(', ') : undefined,
    subject,
    text: `Invoice from ${startDate} - ${endDate}\n\n${text}\n\nTotal Hours: ${totalHours}`,
    html: htmlContent
  }
  
  if (verbose) {
    console.log('Email configuration:')
    console.log('  From:', mailOptions.from)
    console.log('  To:', mailOptions.to)
    if (mailOptions.cc) console.log('  CC:', mailOptions.cc)
    if (mailOptions.bcc) console.log('  BCC:', mailOptions.bcc)
    console.log('  Subject:', mailOptions.subject)
  }
  
  try {
    const info = await transporter.sendMail(mailOptions)
    
    if (verbose) {
      console.log('Email sent:', info.messageId)
    }
    
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function formatHtmlWork(text: string): string {
  const lines = text.split('\n')
  let html = ''

  for (const line of lines) {
    if (line.trim() === '') {
      continue
    }

    if (line.includes('-----')) {
      // Week header
      html += `<div class="week-header">${line}</div>`
    } else if (line.match(/^\d+(\.\d)?hr? - /)) {
      // Task item
      html += `<div class="task-item">• ${line}</div>`
    } else {
      html += `<p>${line}</p>`
    }
  }

  return html
}

export async function sendInvoiceEmailFromConfig(options: EmailOptionsFromConfig): Promise<EmailResult> {
  const { config, startDate, endDate, text, totalHours, testMode, verbose } = options

  // Replace template variables in subject
  let subject = config.email.subject || 'Invoice from {{startDate}} - {{endDate}}'
  subject = subject
    .replace('{{startDate}}', startDate)
    .replace('{{endDate}}', endDate)
    .replace('{{customer}}', config.customer)

  return sendInvoiceEmail({
    customer: config.customer,
    startDate,
    endDate,
    text,
    totalHours,
    testMode,
    verbose,
    recipients: config.email.to,
    cc: config.email.cc,
    bcc: config.email.bcc,
    subject,
    fromName: config.email.fromName
  })
}