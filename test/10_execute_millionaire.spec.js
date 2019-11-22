/* eslint-disable require-jsdoc */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Web3 from 'web3';
import {Enigma, utils, eeConstants} from './enigmaLoader';
import {EnigmaContract, EnigmaTokenContract, SampleContract, EnigmaContractAddress, EnigmaTokenContractAddress,
  proxyAddress, ethNodeAddr} from './contractLoader'
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

  const millionaireAddr = fs.readFileSync(path.join(homedir, '.enigma', 'addr-millionaire.txt'), 'utf-8');

  let task1;
  const addr1 = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const addr2 = '0x0000000000000000000000000000000000000000000000000000000000000002';
  it('should execute compute task', async () => {
    let taskFn = 'add_millionaire(bytes32,uint256)';
    let taskArgs = [
        [addr1, 'bytes32'],
        [1000000, 'uint256'],
      ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task1 = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], millionaireAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
  }, constants.TIMEOUT_COMPUTE);

  it('should get the pending task', async () => {
    task1 = await enigma.getTaskRecordStatus(task1);
    expect(task1.ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
  });

  it('should get the confirmed task', async () => {
    do {
      await sleep(1000);
      task1 = await enigma.getTaskRecordStatus(task1);
      process.stdout.write('Waiting. Current Task Status is '+task1.ethStatus+'\r');
    } while (task1.ethStatus != eeConstants.ETH_STATUS_VERIFIED);
    expect(task1.ethStatus).toEqual(eeConstants.ETH_STATUS_VERIFIED);
    process.stdout.write('Completed. Final Task Status is '+task1.ethStatus+'\n');
  }, constants.TIMEOUT_COMPUTE);

  let task2;
  it('should execute compute task', async () => {
    let taskFn = 'add_millionaire(bytes32,uint256)';
    let taskArgs = [
        [addr2, 'bytes32'],
        [2000000, 'uint256'],
      ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task2 = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], millionaireAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
  }, constants.TIMEOUT_COMPUTE);

  it('should get the pending task', async () => {
    task2 = await enigma.getTaskRecordStatus(task2);
    expect(task2.ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
  });

  it('should get the confirmed task', async () => {
    do {
      await sleep(1000);
      task2 = await enigma.getTaskRecordStatus(task2);
      process.stdout.write('Waiting. Current Task Status is '+task2.ethStatus+'\r');
    } while (task2.ethStatus != eeConstants.ETH_STATUS_VERIFIED);
    expect(task2.ethStatus).toEqual(eeConstants.ETH_STATUS_VERIFIED);
    process.stdout.write('Completed. Final Task Status is '+task2.ethStatus+'\n');
  }, constants.TIMEOUT_COMPUTE);

  let task3;
  it('should execute compute task', async () => {
    let taskFn = 'compute_richest()';
    let taskArgs = [];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task3 = await new Promise((resolve, reject) => {
      enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], millionaireAddr)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
  }, constants.TIMEOUT_COMPUTE);

  it('should get the pending task', async () => {
    task3 = await enigma.getTaskRecordStatus(task3);
    expect(task3.ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
  });

  it('should get the confirmed task', async () => {
    do {
      await sleep(1000);
      task3 = await enigma.getTaskRecordStatus(task3);
      process.stdout.write('Waiting. Current Task Status is '+task3.ethStatus+'\r');
    } while (task3.ethStatus != eeConstants.ETH_STATUS_VERIFIED);
    expect(task3.ethStatus).toEqual(eeConstants.ETH_STATUS_VERIFIED);
    process.stdout.write('Completed. Final Task Status is '+task3.ethStatus+'\n');
  }, constants.TIMEOUT_COMPUTE);

  it('should get and validate the result', async () => {
    task3 = await new Promise((resolve, reject) => {
      enigma.getTaskResult(task3)
        .on(eeConstants.GET_TASK_RESULT_RESULT, (result) => resolve(result))
        .on(eeConstants.ERROR, (error) => reject(error));
    });
    const verifyTaskOutput = await enigma.verifyTaskOutput(task3);
    const verifyTaskStatus = await enigma.verifyTaskStatus(task3);
    expect(verifyTaskOutput).toEqual(true);
    expect(verifyTaskStatus).toEqual(true);
    expect(task3.engStatus).toEqual('SUCCESS');
    expect(task3.encryptedAbiEncodedOutputs).toBeTruthy();
    expect(task3.usedGas).toBeTruthy();
    expect(task3.workerTaskSig).toBeTruthy();
    task3 = await enigma.decryptTaskResult(task3);
    expect(task3.decryptedOutput).toEqual(utils.remove0x(addr2));
  }, constants.TIMEOUT_COMPUTE);

});

