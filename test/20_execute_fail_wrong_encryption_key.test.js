/* eslint-disable require-jsdoc */
const fs = require("fs");
import os from "os";
const path = require("path");
const Web3 = require("web3");
import { Enigma, utils, eeConstants, Task } from "./enigmaLoader";
import {
  EnigmaContract,
  EnigmaTokenContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr
} from "./contractLoader";
import EventEmitter from "eventemitter3";
const constants = require("./testConstants");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Enigma tests", () => {
  let accounts;
  let web3;
  let enigma;
  let epochSize;
  let workerAddress;
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

  function createWrongEncryptionKeyTask(fn, args, gasLimit, gasPx, sender, scAddrOrPreCode, isContractDeploymentTask) {
    let emitter = new EventEmitter();
    (async () => {
      const nonce = parseInt(await enigma.enigmaContract.methods.getUserTaskDeployments(sender).call());
      const scAddr = isContractDeploymentTask ? utils.generateScAddr(sender, nonce) : scAddrOrPreCode;
      const preCode = isContractDeploymentTask ? scAddrOrPreCode : "";

      let preCodeArray = [];
      for (let n = 0; n < preCode.length; n += 2) {
        preCodeArray.push(parseInt(preCode.substr(n, 2), 16));
      }

      const preCodeHash = isContractDeploymentTask
        ? enigma.web3.utils.soliditySha3({ t: "bytes", value: scAddrOrPreCode })
        : "";
      const argsTranspose =
        args === undefined || args.length === 0 ? [[], []] : args[0].map((col, i) => args.map(row => row[i]));
      const abiEncodedArgs = utils.remove0x(enigma.web3.eth.abi.encodeParameters(argsTranspose[1], argsTranspose[0]));
      let abiEncodedArgsArray = [];
      for (let n = 0; n < abiEncodedArgs.length; n += 2) {
        abiEncodedArgsArray.push(parseInt(abiEncodedArgs.substr(n, 2), 16));
      }
      const blockNumber = await enigma.web3.eth.getBlockNumber();
      const workerParams = await enigma.getWorkerParams(blockNumber);
      const firstBlockNumber = workerParams.firstBlockNumber;
      workerAddress = await enigma.selectWorkerGroup(scAddr, workerParams, 1)[0]; // TODO: tmp fix 1 worker
      workerAddress = workerAddress.toLowerCase().slice(-40); // remove leading '0x' if present
      const { publicKey, privateKey } = enigma.obtainTaskKeyPair(sender, nonce);
      try {
        const getWorkerEncryptionKeyResult = await new Promise((resolve, reject) => {
          enigma.client.request(
            "getWorkerEncryptionKey",
            { workerAddress: workerAddress, userPubKey: publicKey },
            (err, response) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(response);
            }
          );
        });
        const { result, id } = getWorkerEncryptionKeyResult;
        const { workerSig } = result;
        const workerEncryptionKey =
          "c54ba8ead9b94f6672da002d08caa3423695ad03842537e64317890f05fa0771457175b0f92bbe22ad8914a1f04b012a3f9883d5559f2c2749e0114fe56e7000";
        // Generate derived key from worker's encryption key and user's private key
        const derivedKey = utils.getDerivedKey(workerEncryptionKey, privateKey);
        // Encrypt function and ABI-encoded args
        const encryptedFn = utils.encryptMessage(derivedKey, fn);
        const encryptedAbiEncodedArgs = utils.encryptMessage(derivedKey, Buffer.from(abiEncodedArgsArray));
        const msg = enigma.web3.utils.soliditySha3(
          { t: "bytes", v: encryptedFn },
          { t: "bytes", v: encryptedAbiEncodedArgs }
        );
        const userTaskSig = await enigma.web3.eth.sign(msg, sender);
        emitter.emit(
          eeConstants.CREATE_TASK,
          new Task(
            scAddr,
            encryptedFn,
            encryptedAbiEncodedArgs,
            gasLimit,
            gasPx,
            id,
            publicKey,
            firstBlockNumber,
            workerAddress,
            workerEncryptionKey,
            sender,
            userTaskSig,
            nonce,
            preCodeArray,
            preCodeHash,
            isContractDeploymentTask
          )
        );
      } catch (err) {
        emitter.emit(eeConstants.ERROR, err);
      }
    })();
    return emitter;
  }

  const homedir = os.homedir();
  const calculatorAddr = fs.readFileSync("/tmp/enigma/addr-calculator.txt", "utf-8");
  let task;
  it(
    "should execute compute task",
    async () => {
      let taskFn = "sub(uint256,uint256)";
      let taskArgs = [[76, "uint256"], [17, "uint256"]];
      let taskGasLimit = 100000;
      let taskGasPx = utils.toGrains(1);

      task = await new Promise((resolve, reject) => {
        createWrongEncryptionKeyTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], calculatorAddr, false)
          .on(eeConstants.CREATE_TASK, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
      task = await new Promise((resolve, reject) => {
        enigma
          .createTaskRecord(task)
          .on(eeConstants.CREATE_TASK_RECORD, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
      await new Promise((resolve, reject) => {
        enigma
          .sendTaskInput(task)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, receipt => resolve(receipt))
          .on(eeConstants.ERROR, error => reject(error));
      });
    },
    constants.TIMEOUT_COMPUTE
  );

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
      } while (task.ethStatus !== 3);
      expect(task.ethStatus).toEqual(3);
      process.stdout.write("Completed. Final Task Status is " + task.ethStatus + "\n");
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "should get the failed result",
    async () => {
      task = await new Promise((resolve, reject) => {
        enigma
          .getTaskResult(task)
          .on(eeConstants.GET_TASK_RESULT_RESULT, result => resolve(result))
          .on(eeConstants.ERROR, error => reject(error));
      });
      expect(task.engStatus).toEqual("FAILED");
      expect(task.encryptedAbiEncodedOutputs).toBeTruthy();
      expect(task.workerTaskSig).toBeTruthy();
    },
    constants.TIMEOUT_COMPUTE
  );
});
