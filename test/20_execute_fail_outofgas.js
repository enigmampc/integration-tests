/* eslint-disable require-jsdoc */
const fs = require("fs");
import os from "os";
const path = require("path");
const Web3 = require("web3");
import { Enigma, utils, eeConstants } from "../enigmaLoader";
import {
  EnigmaContract,
  EnigmaTokenContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr
} from "../contractLoader";
const constants = require("../testConstants");

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

  const calculatorAddr = fs.readFileSync("/tmp/enigma/addr-calculator.txt", "utf-8");
  let task;
  it("should execute compute task", async () => {
    let taskFn = "add(uint,uint)";
    let taskArgs = [
      [24, "uint256"],
      [67, "uint256"]
    ];
    let taskGasLimit = 1;
    let taskGasPx = utils.toGrains(1);
    task = await new Promise((resolve, reject) => {
      enigma
        .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], calculatorAddr, constants.RETRIES_COMPUTE)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, result => resolve(result))
        .on(eeConstants.ERROR, error => reject(error));
    });
  });

  it("should get the pending task", async () => {
    task = await enigma.getTaskRecordStatus(task);
    expect(task.ethStatus).toEqual(1);
  });

  it(
    "should get the failed task receipt",
    async () => {
      do {
        await sleep(1000);
        task = await enigma.getTaskRecordStatus(task);
        process.stdout.write("Waiting. Current Task Status is " + task.ethStatus + "\r");
      } while (task.ethStatus != 3);
      expect(task.ethStatus).toEqual(3);
      process.stdout.write("Completed. Final Task Status is " + task.ethStatus + "\n");
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the failed result",
    async () => {
      do {
        await sleep(1000);
        task = await new Promise((resolve, reject) => {
          enigma
            .getTaskResult(task)
            .on(eeConstants.GET_TASK_RESULT_RESULT, result => resolve(result))
            .on(eeConstants.ERROR, error => reject(error));
        });
      } while (!task.engStatus);
      expect(task.engStatus).toEqual("FAILED");
      expect(task.encryptedAbiEncodedOutputs).toBeTruthy();
      expect(task.workerTaskSig).toBeTruthy();
      task = await enigma.decryptTaskResult(task);
      console.log("Output is: " + task.decryptedOutput);
    },
    constants.TIMEOUT_COMPUTE
  );
});
