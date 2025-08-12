import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)

// Create __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async () => {
  try {
    // Kill any existing validator processes
    try {
      await execAsync('pkill -f solana-test-validator')
    } catch {
      // Ignore if already killed
    }

    const ledgerPath = path.resolve(__dirname, '../test-ledger')

    // Remove test-ledger directory
    try {
      console.log(`Cleaning up test-ledger at: ${ledgerPath}`)
      await fs.rm(ledgerPath, { recursive: true, force: true })
    } catch (err) {
      console.warn(`Failed to remove test-ledger at ${ledgerPath}:`, err)
    }
    process.exit(1)
  } catch (error) {
    console.error('Teardown failed:', error)
    process.exit(1)
  }
}
