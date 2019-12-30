/* eslint-disable require-jsdoc */
const fs = require("fs");
import os from "os";
const path = require("path");
const Web3 = require("web3");
import { Enigma, utils, eeConstants } from "./enigmaLoader";
import {
  EnigmaContract,
  EnigmaTokenContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr
} from "./contractLoader";
import * as constants from "./testConstants";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Enigma tests", () => {
  let accounts;
  let web3;
  let enigma;
  let epochSize;
  it("initializes", () => {
    const provider = new Web3.providers.HttpProvider(ethNodeAddr);
    web3 = new Web3(provider);
    return web3.eth.getAccounts().then(result => {
      accounts = result;
      enigma = new Enigma(web3, EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, {
        gas: 4712388,
        gasPrice: 100000000000,
        from: accounts[0]
      });
      enigma.admin();
      enigma.setTaskKeyPair("cupcake");
      expect(Enigma.version()).toEqual("0.0.1");
    });
  });

  const homedir = os.homedir();
  const revertAddr = fs.readFileSync(path.join(homedir, ".enigma", "addr-revert.txt"), "utf-8");

  let task1;
  it(
    "should read the state and validate initial value",
    async () => {
      let taskFn = "get_last_sum()";
      let taskArgs = [];
      let taskGasLimit = 100000;
      let taskGasPx = utils.toGrains(1);
      task1 = await new Promise((resolve, reject) => {
        enigma
          .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], revertAddr, constants.RETRIES_COMPUTE)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the confirmed task",
    async () => {
      do {
        await sleep(1000);
        task1 = await enigma.getTaskRecordStatus(task1);
        process.stdout.write("Waiting. Current Task Status is " + task1.ethStatus + "\r");
      } while (task1.ethStatus != 2);
      expect(task1.ethStatus).toEqual(2);
      process.stdout.write("Completed. Final Task Status is " + task1.ethStatus + "\n");
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the result and verify the computation is correct",
    async () => {
      task1 = await new Promise((resolve, reject) => {
        enigma
          .getTaskResult(task1)
          .on(eeConstants.GET_TASK_RESULT_RESULT, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
      expect(task1.engStatus).toEqual("SUCCESS");
      expect(task1.encryptedAbiEncodedOutputs).toBeTruthy();
      task1 = await enigma.decryptTaskResult(task1);
      expect(task1.usedGas).toBeTruthy();
      expect(task1.workerTaskSig).toBeTruthy();
      expect(parseInt(task1.decryptedOutput, 16)).toEqual(12);
    },
    constants.TIMEOUT_COMPUTE
  );

  let task2;
  it(
    "should execute sum_and_call, and verify output of computation",
    async () => {
      let taskFn = "sum_and_call(uint256,uint256,address)";
      // the address argument must be an existing contract address, otherwise this test that is supposed to fail
      // will always succeed in Ganache. Using EnigmaContractAddress as long as it never has a function called 'record()'
      let taskArgs = [
        [2, "uint256"],
        [3, "uint256"],
        [EnigmaContractAddress, "address"]
      ];
      let taskGasLimit = 100000;
      let taskGasPx = utils.toGrains(1);
      task2 = await new Promise((resolve, reject) => {
        enigma
          .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], revertAddr, constants.RETRIES_COMPUTE)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the confirmed task failure",
    async () => {
      do {
        await sleep(1000);
        task2 = await enigma.getTaskRecordStatus(task2);
        process.stdout.write("Waiting. Current Task Status is " + task2.ethStatus + "\r");
      } while (task2.ethStatus != 4);
      expect(task2.ethStatus).toEqual(4);
      process.stdout.write("Completed. Final Task Status is " + task2.ethStatus + "\n");
    },
    constants.TIMEOUT_COMPUTE
  );

  let task3;
  it(
    "should read the state again, and validate the value is still the initial value, despite the write_state!",
    async () => {
      let taskFn = "get_last_sum()";
      let taskArgs = [];
      let taskGasLimit = 100000;
      let taskGasPx = utils.toGrains(1);
      task3 = await new Promise((resolve, reject) => {
        enigma
          .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], revertAddr, constants.RETRIES_COMPUTE)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the confirmed task",
    async () => {
      do {
        await sleep(1000);
        task3 = await enigma.getTaskRecordStatus(task3);
        process.stdout.write("Waiting. Current Task Status is " + task3.ethStatus + "\r");
      } while (task3.ethStatus != 2);
      expect(task3.ethStatus).toEqual(2);
      process.stdout.write("Completed. Final Task Status is " + task3.ethStatus + "\n");
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the result and verify the computation is correct",
    async () => {
      task3 = await new Promise((resolve, reject) => {
        enigma
          .getTaskResult(task3)
          .on(eeConstants.GET_TASK_RESULT_RESULT, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
      expect(task3.engStatus).toEqual("SUCCESS");
      expect(task3.encryptedAbiEncodedOutputs).toBeTruthy();
      task3 = await enigma.decryptTaskResult(task3);
      expect(task3.usedGas).toBeTruthy();
      expect(task3.workerTaskSig).toBeTruthy();
      expect(parseInt(task3.decryptedOutput, 16)).toEqual(12);
    },
    constants.TIMEOUT_COMPUTE
  );
});
