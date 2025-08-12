import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let validatorProcess

async function checkSolanaValidator() {
    try {
        await execAsync('solana-test-validator --version')
        console.log('solana-test-validator is installed')
        return true
    } catch (error) {
        console.error('Error: solana-test-validator not found')
        return false
    }
}

async function startValidator() {
    try {
        // Kill existing validator
        try {
            await execAsync('pkill -f solana-test-validator')
            await new Promise(resolve => setTimeout(resolve, 1000))
        } catch {
            // Ignore if none found
        }

        // Clean up test-ledger directory
        const ledgerPath = path.resolve(__dirname, '../test-ledger')
        try {
            console.log('Cleaning up existing test-ledger directory...', ledgerPath)
            await fs.rm(ledgerPath, { recursive: true, force: true })
        } catch (error) {
            console.warn('Failed to remove test-ledger directory:', error)
        }

        // Spawn validator process
        validatorProcess = spawn('solana-test-validator', ['--reset'])

        await new Promise((resolve, reject) => {
            validatorProcess.stdout.on('data', (data) => {
                const output = data.toString()

                if (output.includes('RPC URL')) {
                    console.log('Validator stdout:', output)
                    resolve()
                }
            })

            validatorProcess.stderr.on('data', (data) => {
                console.error('Validator stderr:', data.toString())
            })

            validatorProcess.on('error', reject)
            validatorProcess.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Validator exited with code ${code}`))
                }
            })
        })

        // Graceful shutdown on SIGINT or SIGTERM
        const shutdown = () => {
            if (validatorProcess) {
                validatorProcess.kill()
                console.log('Validator process terminated')
            }
            process.exit()
        }

        process.on('SIGINT', shutdown)
        process.on('SIGTERM', shutdown)
    } catch (error) {
        console.error('Error starting validator:', error)
        throw error
    }
}

export default async () => {
    try {
        const isInstalled = await checkSolanaValidator()
        if (!isInstalled) {
            console.error('\nPlease follow these steps:')
            console.error('1. Install Solana CLI tools manually following the instructions in README.md')
            console.error('2. Add Solana to your PATH')
            console.error('3. Verify installation by running: solana-test-validator --version')
            process.exit(1)
        }
        await startValidator()
    } catch (error) {
        console.error('Setup failed:', error)
        process.exit(1)
    }
}