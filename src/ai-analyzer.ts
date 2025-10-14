import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { InvoiceConfig } from './types/config'

const execAsync = promisify(exec)

interface CommitData {
  message: string
  date: Date
  repo: string
}

interface AIAnalysisResult {
  codeAnalysis?: string
  lineItems?: string
}

const DEFAULT_CODE_ANALYSIS_PROMPT = `You are analyzing git commits and code changes for an invoice.

Your task: Review the provided commit messages and identify what was actually built, fixed, or improved.

Focus on:
- Specific features added (not generic "new features")
- Specific bugs fixed (not generic "bug fixes")
- Infrastructure/DevOps changes
- Performance improvements
- Refactoring with clear business value

Be concise but specific. Write in past tense. Group related work together.

Output format: A detailed analysis of work completed, organized by theme or feature area.

Example output:
"Enhanced fax queue system with RethinkDB migration, including real-time status updates and improved error handling. Fixed authentication issues in getSentFax endpoint with proper user credential checking. Improved S3 configuration for document storage with correct region settings and bucket separation."

Commit data will be provided below. Analyze and summarize the actual work done:`

const DEFAULT_LINE_ITEM_PROMPT = `You are generating professional invoice line items from a code analysis.

Your task: Convert the technical analysis into clear, client-friendly invoice line items with hour estimates.

Guidelines:
- Use professional, non-technical language
- Be specific about what was delivered
- Each line item should describe tangible value
- Assign realistic hours based on complexity
- Group related work into logical line items
- Total hours must match the specified amount

Format each line item as:
[hours]hr - [Description of work]

Example:
12hr - Enhanced fax queue system with real-time status tracking and error recovery
8hr - Resolved authentication and access control issues across API endpoints
6hr - Improved document storage infrastructure and performance
4hr - Code refactoring and technical debt reduction

The code analysis and total hours will be provided below. Generate professional line items:`

/**
 * Run Claude Code CLI with a prompt
 */
async function runClaudeCLI(prompt: string, verbose?: boolean): Promise<string> {
  try {
    if (verbose) {
      console.log('Running Claude Code analysis...')
    }

    // Create temp file for prompt
    const tempDir = os.tmpdir()
    const promptFile = path.join(tempDir, `invoice-prompt-${Date.now()}.txt`)
    fs.writeFileSync(promptFile, prompt)

    // Run claude code with the prompt
    const command = `claude code --dangerously-skip-permissions < "${promptFile}"`

    if (verbose) {
      console.log(`Executing: ${command}`)
    }

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/bash'
    })

    // Clean up temp file
    try {
      fs.unlinkSync(promptFile)
    } catch {
      // Ignore cleanup errors
    }

    if (stderr && verbose) {
      console.log('Claude stderr:', stderr)
    }

    return stdout.trim()
  } catch (error) {
    throw new Error(`Claude CLI error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Stage 1: Analyze code changes from commits
 */
export async function analyzeCodeChanges(
  commits: CommitData[],
  config: InvoiceConfig,
  verbose?: boolean
): Promise<string> {
  if (!config.ai?.enabled || !config.ai?.codeAnalysis?.enabled) {
    return ''
  }

  if (verbose) {
    console.log(`\n🤖 AI Stage 1: Analyzing ${commits.length} commits...`)
  }

  // Prepare commit data for analysis
  const commitSummary = commits
    .map((c, i) => `${i + 1}. [${c.repo}] ${c.message}`)
    .join('\n')

  const prompt = config.ai.codeAnalysis?.prompt || DEFAULT_CODE_ANALYSIS_PROMPT
  const fullPrompt = `${prompt}\n\n=== COMMIT DATA ===\n${commitSummary}\n\n=== END COMMIT DATA ===\n\nProvide your analysis:`

  try {
    const analysis = await runClaudeCLI(fullPrompt, verbose)

    if (verbose) {
      console.log('✅ Code analysis complete')
      console.log('Analysis preview:', analysis.substring(0, 200) + '...')
    }

    return analysis
  } catch (error) {
    console.error('❌ Code analysis failed:', error)
    return ''
  }
}

/**
 * Stage 2: Generate invoice line items from analysis
 */
export async function generateLineItems(
  codeAnalysis: string,
  totalHours: number,
  config: InvoiceConfig,
  verbose?: boolean
): Promise<string> {
  if (!config.ai?.enabled || !config.ai?.lineItemGeneration?.enabled) {
    return ''
  }

  if (verbose) {
    console.log(`\n🤖 AI Stage 2: Generating line items for ${totalHours} hours...`)
  }

  const prompt = config.ai.lineItemGeneration?.prompt || DEFAULT_LINE_ITEM_PROMPT
  const fullPrompt = `${prompt}\n\n=== CODE ANALYSIS ===\n${codeAnalysis}\n\n=== END CODE ANALYSIS ===\n\nTotal hours to allocate: ${totalHours}\n\nGenerate invoice line items:`

  try {
    const lineItems = await runClaudeCLI(fullPrompt, verbose)

    if (verbose) {
      console.log('✅ Line items generated')
      console.log('Line items preview:', lineItems.substring(0, 200) + '...')
    }

    return lineItems
  } catch (error) {
    console.error('❌ Line item generation failed:', error)
    return ''
  }
}

/**
 * Full AI analysis pipeline
 */
export async function runAIAnalysis(
  commits: CommitData[],
  totalHours: number,
  config: InvoiceConfig,
  verbose?: boolean
): Promise<AIAnalysisResult> {
  const result: AIAnalysisResult = {}

  if (!config.ai?.enabled) {
    return result
  }

  // Stage 1: Analyze code changes
  if (config.ai.codeAnalysis?.enabled) {
    result.codeAnalysis = await analyzeCodeChanges(commits, config, verbose)
  }

  // Stage 2: Generate line items
  if (config.ai.lineItemGeneration?.enabled && result.codeAnalysis) {
    result.lineItems = await generateLineItems(result.codeAnalysis, totalHours, config, verbose)
  }

  return result
}
