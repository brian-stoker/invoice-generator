import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from 'simple-git'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, parseISO } from 'date-fns'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { InvoiceConfig } from './types/config'
import { glob } from 'glob'
import { runAIAnalysis } from './ai-analyzer'

const execAsync = promisify(exec)

interface InvoiceOptions {
  customer: string
  weeks?: number
  startDate?: string
  endDate?: string
  verbose?: boolean
  repoPaths?: string[]
  githubRepos?: string[]
  hoursPerWeek?: number
}

interface InvoiceOptionsFromConfig {
  config: InvoiceConfig
  verbose?: boolean
}

interface WeeklyWork {
  weekStart: Date
  weekEnd: Date
  dateRange: string
  totalHours: number
  tasks: TaskSummary[]
}

interface TaskSummary {
  description: string
  hours: number
  commits: number
}

export interface InvoiceData {
  customer: string
  startDate: string
  endDate: string
  text: string
  totalHours: number
  weeks: WeeklyWork[]
}

export async function generateInvoice(options: InvoiceOptions, config?: InvoiceConfig): Promise<InvoiceData | null> {
  const { customer, weeks = 2, verbose, repoPaths, githubRepos, hoursPerWeek = 30 } = options

  // Calculate date range
  let endDate: Date
  let startDate: Date

  if (options.endDate) {
    endDate = parseISO(options.endDate)
  } else {
    // End of last week
    endDate = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 })
  }

  if (options.startDate) {
    startDate = parseISO(options.startDate)
  } else {
    // Start of N weeks ago
    startDate = startOfWeek(subWeeks(endDate, weeks - 1), { weekStartsOn: 0 })
  }

  if (verbose) {
    console.log(`Analyzing commits from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`)
  }

  // Analyze commits for each week
  const weeklyWork: WeeklyWork[] = []
  const allCommits: Array<{ message: string; date: Date; repo: string }> = []
  let currentWeekStart = startDate

  while (currentWeekStart <= endDate) {
    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 })

    const { weekWork, commits } = await analyzeWeekWithCommits(
      currentWeekStart,
      currentWeekEnd,
      hoursPerWeek,
      {
        githubRepos,
        repoPaths,
        customer,
        verbose
      }
    )

    weeklyWork.push(weekWork)
    allCommits.push(...commits)
    currentWeekStart = addWeeks(currentWeekStart, 1)
  }

  const totalHours = weeklyWork.reduce((sum, week) => sum + week.totalHours, 0)

  // Run AI analysis if enabled
  if (config?.ai?.enabled && allCommits.length > 0) {
    try {
      const aiResult = await runAIAnalysis(allCommits, totalHours, config, verbose)

      // If we have AI-generated line items, use them instead of categorization
      if (aiResult.lineItems) {
        // Parse AI-generated line items and redistribute across weeks
        const aiTasks = parseAILineItems(aiResult.lineItems)

        // Redistribute tasks across weeks proportionally
        weeklyWork.forEach((week, index) => {
          const weekProportion = week.totalHours / totalHours
          week.tasks = aiTasks.map(task => ({
            ...task,
            hours: Math.round(task.hours * weekProportion * 2) / 2 // Round to nearest 0.5
          })).filter(task => task.hours > 0)
        })
      }
    } catch (error) {
      if (verbose) {
        console.error('AI analysis failed, using standard categorization:', error)
      }
      // Continue with standard categorization on error
    }
  }

  // Generate invoice text
  const invoiceText = formatInvoice(weeklyWork)

  return {
    customer,
    startDate: format(startDate, 'MMMM d, yyyy'),
    endDate: format(endDate, 'MMMM d, yyyy'),
    text: invoiceText,
    totalHours,
    weeks: weeklyWork
  }
}

export async function generateInvoiceFromConfig(options: InvoiceOptionsFromConfig): Promise<InvoiceData | null> {
  const { config, verbose } = options

  // Use repoDirs (local directories) if provided, otherwise empty
  const repoPaths = config.git.repoDirs || []

  return generateInvoice({
    customer: config.customer,
    weeks: config.git.weeks,
    repoPaths,
    hoursPerWeek: config.git.hoursPerWeek,
    verbose,
    githubRepos: config.git.repos
  }, config)
}

async function resolveRepoPaths(patterns: string[], verbose?: boolean): Promise<string[]> {
  const dirs: string[] = []

  for (const pattern of patterns) {
    try {
      // Support glob patterns
      const matches = await glob(pattern, { absolute: true })

      for (const match of matches) {
        const stat = await fs.promises.stat(match)

        if (stat.isDirectory()) {
          // Check if it's a git repository
          const gitPath = path.join(match, '.git')
          try {
            await fs.promises.access(gitPath)
            dirs.push(match)
          } catch {
            if (verbose) {
              console.log(`  Skipping ${match} (not a git repository)`)
            }
          }
        }
      }
    } catch (error) {
      if (verbose) {
        console.error(`Error resolving pattern ${pattern}:`, error)
      }
    }
  }

  return dirs
}

async function getProjectDirectories(customer: string): Promise<string[]> {
  const dirs: string[] = []
  const baseDir = '/opt/dev'

  try {
    // Look for xferall* directories
    const files = await fs.promises.readdir(baseDir)

    for (const file of files) {
      if (file.toLowerCase().includes(customer.toLowerCase())) {
        const fullPath = path.join(baseDir, file)
        const stat = await fs.promises.stat(fullPath)

        if (stat.isDirectory()) {
          // Check if it's a git repository
          const gitPath = path.join(fullPath, '.git')
          try {
            await fs.promises.access(gitPath)
            dirs.push(fullPath)
          } catch {
            // Not a git repo, skip
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading project directories:', error)
  }

  return dirs
}

interface AnalyzeWeekOptions {
  githubRepos?: string[]
  repoPaths?: string[]
  customer?: string
  verbose?: boolean
}

async function analyzeWeek(
  weekStart: Date,
  weekEnd: Date,
  hoursPerWeek: number,
  options: AnalyzeWeekOptions
): Promise<WeeklyWork> {
  const result = await analyzeWeekWithCommits(weekStart, weekEnd, hoursPerWeek, options)
  return result.weekWork
}

async function analyzeWeekWithCommits(
  weekStart: Date,
  weekEnd: Date,
  hoursPerWeek: number,
  options: AnalyzeWeekOptions
): Promise<{ weekWork: WeeklyWork; commits: Array<{ message: string; date: Date; repo: string }> }> {
  const { githubRepos, repoPaths, customer, verbose } = options
  const allCommits: Array<{ message: string; date: Date; repo: string }> = []

  // Primary: Try to get commits from GitHub repos
  if (githubRepos && githubRepos.length > 0) {
    if (verbose) {
      console.log(`Fetching commits from GitHub repos: ${githubRepos.join(', ')}`)
    }

    for (const repo of githubRepos) {
      try {
        const commits = await getGitHubCommitsForRepo(repo, weekStart, weekEnd, verbose)
        allCommits.push(...commits)
        if (verbose) {
          console.log(`  Found ${commits.length} commits in ${repo}`)
        }
      } catch (error) {
        if (verbose) {
          console.log(`  Could not fetch GitHub commits from ${repo}:`, error)
        }
      }
    }
  }

  // Fallback: If no GitHub commits found, try local directories
  if (allCommits.length === 0) {
    if (verbose) {
      console.log('No GitHub commits found, falling back to local repositories...')
    }

    let projectDirs: string[] = []

    // Try repoPaths first
    if (repoPaths && repoPaths.length > 0) {
      projectDirs = await resolveRepoPaths(repoPaths, verbose)
    }
    // If still no dirs and we have a customer, try customer-based search
    else if (customer) {
      projectDirs = await getProjectDirectories(customer)
    }

    if (verbose && projectDirs.length > 0) {
      console.log(`Found ${projectDirs.length} local directories:`)
      projectDirs.forEach(dir => console.log(`  - ${dir}`))
    }

    for (const dir of projectDirs) {
      const git: SimpleGit = simpleGit(dir)

      try {
        const log = await git.log({
          from: format(weekStart, 'yyyy-MM-dd'),
          to: format(weekEnd, 'yyyy-MM-dd'),
          '--all': null
        })

        const repoName = path.basename(dir)

        for (const commit of log.all) {
          allCommits.push({
            message: commit.message,
            date: new Date(commit.date),
            repo: repoName
          })
        }

        if (verbose) {
          console.log(`  Found ${log.all.length} commits in ${repoName}`)
        }
      } catch (error) {
        if (verbose) {
          console.log(`  Could not read git log from ${dir}:`, error)
        }
      }
    }
  }

  if (verbose) {
    console.log(`Total commits found: ${allCommits.length}`)
  }

  // Analyze and categorize commits
  const tasks = categorizeCommits(allCommits)

  // Use configured hours per week
  const totalHours = hoursPerWeek
  const tasksWithHours = distributeHours(tasks, totalHours)

  const weekWork: WeeklyWork = {
    weekStart,
    weekEnd,
    dateRange: `${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`,
    totalHours,
    tasks: tasksWithHours
  }

  return {
    weekWork,
    commits: allCommits
  }
}

async function getGitHubCommitsForRepo(
  repo: string,
  weekStart: Date,
  weekEnd: Date,
  verbose?: boolean
): Promise<Array<{ message: string; date: Date; repo: string }>> {
  const commits: Array<{ message: string; date: Date; repo: string }> = []

  try {
    // Use gh CLI to get commits from GitHub
    const since = format(weekStart, 'yyyy-MM-dd')
    const until = format(weekEnd, 'yyyy-MM-dd')

    // Build the gh API command
    const command = `gh api repos/${repo}/commits --paginate -q '.[] | select(.commit.author.date >= "${since}" and .commit.author.date <= "${until}") | {message: .commit.message, date: .commit.author.date, author: .commit.author.name}'`

    if (verbose) {
      console.log(`  Executing: ${command}`)
    }

    const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 })

    if (stdout) {
      const lines = stdout.trim().split('\n').filter(line => line)
      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          commits.push({
            message: data.message,
            date: new Date(data.date),
            repo: repo.split('/')[1] || repo
          })
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  } catch (error) {
    if (verbose) {
      console.log(`GitHub API error for ${repo}:`, error)
    }
    // Don't throw, just return empty array so we can try other repos or fallback
  }

  return commits
}

function categorizeCommits(commits: Array<{ message: string; date: Date; repo: string }>): TaskSummary[] {
  const categories = new Map<string, { commits: number; messages: string[] }>()
  
  for (const commit of commits) {
    const category = getCommitCategory(commit.message)
    
    if (!categories.has(category)) {
      categories.set(category, { commits: 0, messages: [] })
    }
    
    const cat = categories.get(category)!
    cat.commits++
    cat.messages.push(commit.message)
  }
  
  // Convert to task summaries
  const tasks: TaskSummary[] = []
  
  for (const [category, data] of categories) {
    tasks.push({
      description: category,
      hours: 0, // Will be calculated
      commits: data.commits
    })
  }
  
  // Sort by commit count (most commits first)
  tasks.sort((a, b) => b.commits - a.commits)
  
  return tasks
}

function getCommitCategory(message: string): string {
  const msg = message.toLowerCase()
  
  // Categorize based on keywords
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('error')) {
    return 'Bug fixes and error resolution'
  }
  
  if (msg.includes('feat') || msg.includes('add') || msg.includes('implement')) {
    return 'New feature development'
  }
  
  if (msg.includes('refactor') || msg.includes('clean') || msg.includes('optimize')) {
    return 'Code refactoring and optimization'
  }
  
  if (msg.includes('test') || msg.includes('spec')) {
    return 'Testing and quality assurance'
  }
  
  if (msg.includes('doc') || msg.includes('readme')) {
    return 'Documentation updates'
  }
  
  if (msg.includes('ui') || msg.includes('style') || msg.includes('css')) {
    return 'UI/UX improvements'
  }
  
  if (msg.includes('data') || msg.includes('database') || msg.includes('migration')) {
    return 'Database and data management'
  }
  
  if (msg.includes('api') || msg.includes('endpoint') || msg.includes('route')) {
    return 'API development and updates'
  }
  
  if (msg.includes('deploy') || msg.includes('build') || msg.includes('ci')) {
    return 'Deployment and DevOps'
  }
  
  // Check for specific project mentions
  if (msg.includes('fax')) {
    return 'Fax system development'
  }
  
  if (msg.includes('dashboard') || msg.includes('insight') || msg.includes('report')) {
    return 'Dashboard and reporting features'
  }
  
  if (msg.includes('transfer') || msg.includes('patient')) {
    return 'Patient transfer workflow'
  }
  
  return 'General development and maintenance'
}

function distributeHours(tasks: TaskSummary[], totalHours: number): TaskSummary[] {
  if (tasks.length === 0) {
    return [{
      description: 'Development and maintenance',
      hours: totalHours,
      commits: 0
    }]
  }
  
  const totalCommits = tasks.reduce((sum, task) => sum + task.commits, 0)
  
  if (totalCommits === 0) {
    // No commits, distribute evenly
    const hoursPerTask = totalHours / tasks.length
    return tasks.map(task => ({
      ...task,
      hours: Math.round(hoursPerTask * 2) / 2 // Round to nearest 0.5
    }))
  }
  
  // Distribute hours based on commit count
  let remainingHours = totalHours
  const tasksWithHours = tasks.map((task, index) => {
    const isLast = index === tasks.length - 1
    
    if (isLast) {
      // Give remaining hours to last task
      return {
        ...task,
        hours: remainingHours
      }
    }
    
    const proportion = task.commits / totalCommits
    const hours = Math.round(totalHours * proportion * 2) / 2 // Round to nearest 0.5
    const adjustedHours = Math.min(hours, remainingHours)
    
    remainingHours -= adjustedHours
    
    return {
      ...task,
      hours: adjustedHours
    }
  })
  
  return tasksWithHours.filter(task => task.hours > 0)
}

function parseAILineItems(lineItemsText: string): TaskSummary[] {
  const tasks: TaskSummary[] = []
  const lines = lineItemsText.split('\n')

  for (const line of lines) {
    // Match pattern: [number]hr - [description]
    // or [number.5]hr - [description]
    // Also support markdown bold: **[number]hr** - [description]
    const match = line.match(/\*{0,2}(\d+(?:\.\d+)?)hr\*{0,2}\s*-\s*(.+)$/i)

    if (match) {
      const hours = parseFloat(match[1])
      const description = match[2].trim()

      tasks.push({
        description,
        hours,
        commits: 0 // AI-generated tasks don't track commit count
      })
    }
  }

  return tasks
}

function formatInvoice(weeks: WeeklyWork[]): string {
  const lines: string[] = []

  for (const week of weeks) {
    // Week header
    lines.push(`${week.dateRange} ----- ${week.totalHours}hrs`)

    // Task details
    for (const task of week.tasks) {
      if (task.hours > 0) {
        const hoursStr = task.hours % 1 === 0 ? task.hours.toString() : task.hours.toFixed(1)
        lines.push(`${hoursStr}hr - ${task.description}`)
      }
    }

    lines.push('') // Empty line between weeks
  }

  return lines.join('\n').trim()
}