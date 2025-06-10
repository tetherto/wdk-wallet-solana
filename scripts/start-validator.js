import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let validatorProcess;

async function checkSolanaValidator() {
    try {
        await execAsync('solana-test-validator --version');
        console.log('solana-test-validator is already installed');
        return true;
    } catch (error) {
        console.log('solana-test-validator not found, installing...');
        return false;
    }
}

async function installSolanaValidator() {

    console.log('Installing solana-test-validator...');
    const { stdout, stderr } = await execAsync('sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"');
    console.log('Installation output:', stdout);
    if (stderr) console.error('Installation errors:', stderr);

    const isInstalled = await checkSolanaValidator();
    if (!isInstalled) {
        throw new Error('Installation failed');
    }
    console.log('solana-test-validator installed successfully');

}

async function startValidator() {
    try {
        // Kill any existing validator processes

        await execAsync('pkill -f solana-test-validator');
        await new Promise(resolve => setTimeout(resolve, 1000));


        // Clean up any existing test-ledger directory

        await execAsync('rm -rf ~/.local/share/solana/test-ledger*');

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
            await installSolanaValidator();
        }
        await startValidator();
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

main(); 