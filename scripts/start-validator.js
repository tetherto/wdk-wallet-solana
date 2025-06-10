import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let validatorProcess;

async function checkSolanaValidator() {
    try {
        await execAsync('solana-test-validator --version');
        console.log('solana-test-validator is installed');
        return true;
    } catch (error) {
        console.error('Error: solana-test-validator not found');
        return false;
    }
}

async function startValidator() {
    try {
        // Kill any existing validator processes
        try {
            await execAsync('pkill -f solana-test-validator');
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            // Ignore errors if no process was found
        }

        // Clean up any existing test-ledger directory
        try {
            await execAsync('rm -rf ~/.local/share/solana/test-ledger*');
        } catch (error) {
            // Ignore errors if directory doesn't exist
        }

        validatorProcess = spawn('solana-test-validator', [
            '--reset'
        ]);

        validatorProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`Validator stdout: ${output}`);
        });

        validatorProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.error(`Validator stderr: ${output}`);
        });

        validatorProcess.on('error', (error) => {
            console.error('Validator process error:', error);
        });

        validatorProcess.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Validator process exited with code ${code}`);
            }
        });

        // Handle process termination
        process.on('SIGINT', () => {
            if (validatorProcess) {
                validatorProcess.kill();
                console.log('Validator process terminated');
            }
            process.exit();
        });

        process.on('SIGTERM', () => {
            if (validatorProcess) {
                validatorProcess.kill();
                console.log('Validator process terminated');
            }
            process.exit();
        });

    } catch (error) {
        console.error('Error starting validator:', error);
        throw error;
    }
}

async function main() {
    try {
        const isInstalled = await checkSolanaValidator();
        if (!isInstalled) {
            console.error('\nPlease follow these steps:');
            console.error('1. Install Solana CLI tools manually following the instructions in README.md');
            console.error('2. Add Solana to your PATH');
            console.error('3. Verify installation by running: solana-test-validator --version');
            process.exit(1);
        }
        await startValidator();
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main(); 