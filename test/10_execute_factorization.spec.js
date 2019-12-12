/* eslint-disable require-jsdoc */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Web3 from 'web3';
import {Enigma, utils, eeConstants} from './enigmaLoader';
import {EnigmaContract, EnigmaTokenContract, EnigmaContractAddress, EnigmaTokenContractAddress,
    proxyAddress, ethNodeAddr} from './contractLoader';
import * as constants from './testConstants';


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Enigma tests', () => {
    let accounts;
    let web3;
    let enigma;
    let epochSize;
    it('initializes', () => {
        const provider = new Web3.providers.HttpProvider(ethNodeAddr);
        web3 = new Web3(provider);
        return web3.eth.getAccounts().then((result) => {
            accounts = result;
            enigma = new Enigma(
                web3,
                EnigmaContractAddress,
                EnigmaTokenContractAddress,
                proxyAddress,
                {
                    gas: 4712388,
                    gasPrice: 100000000000,
                    from: accounts[0],
                },
            );
            enigma.admin();
            enigma.setTaskKeyPair('cupcake');
            expect(Enigma.version()).toEqual('0.0.1');
        });
    });

    const homedir = os.homedir();

    const factorAddr = fs.readFileSync(path.join(homedir, '.enigma', 'addr-factorization.txt'), 'utf-8');
    let task1;
    it('should execute compute task', async () => {
        let taskFn = 'find_number_of_prime_factors(uint64)';
        let taskArgs = [[8972, 'uint64']];
        let taskGasLimit = 100000;
        let taskGasPx = utils.toGrains(1);
        task1 = await new Promise((resolve, reject) => {
            enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], factorAddr)
                .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
                .on(eeConstants.ERROR, (error) => reject(error));
        });
    }, constants.TIMEOUT_COMPUTE);

    it('should get the pending task', async () => {
        task1 = await enigma.getTaskRecordStatus(task1);
        expect(task1.ethStatus).toEqual(1);
    });

    it('should get the confirmed task', async () => {
        do {
            await sleep(1000);
            task1 = await enigma.getTaskRecordStatus(task1);
            process.stdout.write('Waiting. Current Task Status is '+task1.ethStatus+'\r');
        } while (task1.ethStatus != 2);
        expect(task1.ethStatus).toEqual(2);
        process.stdout.write('Completed. Final Task Status is '+task1.ethStatus+'\n');
    }, constants.TIMEOUT_COMPUTE);

    it('should get the result and verify the computation is correct', async () => {
        task1 = await new Promise((resolve, reject) => {
            enigma.getTaskResult(task1)
                .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
                .on(eeConstants.ERROR, (error) => reject(error));
        });
        expect(task1.engStatus).toEqual('SUCCESS');
        expect(task1.encryptedAbiEncodedOutputs).toBeTruthy();
        task1 = await enigma.decryptTaskResult(task1);
        expect(task1.usedGas).toBeTruthy();
        expect(task1.workerTaskSig).toBeTruthy();
        expect(parseInt(task1.decryptedOutput, 16)).toEqual(2);
    }, constants.TIMEOUT_COMPUTE);
});
