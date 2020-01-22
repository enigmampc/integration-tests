/* eslint-disable require-jsdoc */
const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, utils, eeConstants, Task } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const EventEmitter = require("eventemitter3");
const constants = require("../testConstants");
const { sleep, ethStatusNameToCode } = require("../scUtils");

describe("Fail to deploy because of wrong encryption key", () => {
  let accounts;
  let web3;
  let enigma;
  let workerAddress;

  beforeAll(async () => {
    web3 = new Web3(new Web3.providers.HttpProvider(ethNodeAddr));
    accounts = await web3.eth.getAccounts();
    enigma = new Enigma(web3, EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, {
      gas: 4712388,
      gasPrice: 100000000000,
      from: accounts[0]
    });
    enigma.admin();
    enigma.setTaskKeyPair("cupcake");
    expect(Enigma.version()).toEqual("0.0.1");
  });

  function createWrongEncryptionKeyTask(fn, args, gasLimit, gasPx, sender, scAddrOrPreCode, isContractDeploymentTask) {
    let emitter = new EventEmitter();
    (async () => {
      const nonce = parseInt(await enigma.enigmaContract.methods.getUserTaskDeployments(sender).call());
      const scAddr = isContractDeploymentTask ? utils.generateScAddr(sender, nonce) : scAddrOrPreCode;

      let preCode;
      let preCodeGzip;
      if (isContractDeploymentTask) {
        if (Buffer.isBuffer(scAddrOrPreCode)) {
          preCode = scAddrOrPreCode;
          // gzip the preCode
          preCodeGzip = await utils.gzip(preCode);
        } else {
          throw Error("PreCode expected to be a Buffer, instead got " + typeof scAddrOrPreCode);
        }
      } else {
        preCode = "";
        preCodeGzip = "";
      }

      const preCodeHash = isContractDeploymentTask
        ? enigma.web3.utils.soliditySha3({ t: "bytes", value: preCode.toString("hex") })
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
            preCodeGzip.toString("base64"),
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

  it(
    "should fail to deploy with wrong encryption keys",
    async () => {
      const scTaskFn = "construct()";
      const scTaskArgs = "";
      const scTaskGasLimit = 1000000;
      const scTaskGasPx = utils.toGrains(1);
      const preCode = fs.readFileSync(path.resolve(__dirname, "../secretContracts/calculator.wasm"));
      let retryCount = 0;
      let scTask2;
      while (true) {
        try {
          scTask2 = await new Promise((resolve, reject) => {
            createWrongEncryptionKeyTask(scTaskFn, scTaskArgs, scTaskGasLimit, scTaskGasPx, accounts[0], preCode, true)
              .on(eeConstants.CREATE_TASK, resolve)
              .on(eeConstants.ERROR, reject);
          });
          scTask2 = await new Promise((resolve, reject) => {
            enigma
              .createTaskRecord(scTask2)
              .on(eeConstants.CREATE_TASK_RECORD, resolve)
              .on(eeConstants.ERROR, reject);
          });
          await new Promise((resolve, reject) => {
            enigma
              .sendTaskInput(scTask2)
              .on(eeConstants.DEPLOY_SECRET_CONTRACT_RESULT, resolve)
              .on(eeConstants.ERROR, reject);
          });
          break;
        } catch (err) {
          if (
            retryCount++ >= constants.RETRIES_DEPLOY ||
            err !== "Returned error: VM Exception while processing transaction: revert Wrong epoch for this task"
          ) {
            throw err;
          }
        }
      }

      do {
        await sleep(1000);
        scTask2 = await enigma.getTaskRecordStatus(scTask2);
      } while (scTask2.ethStatus !== ethStatusNameToCode["ETH_STATUS_FAILED"]);
      expect(scTask2.ethStatus).toEqual(ethStatusNameToCode["ETH_STATUS_FAILED"]);

      const isDeployed = await enigma.admin.isDeployed(scTask2.scAddr);
      expect(isDeployed).toEqual(false);

      const codeHash = await enigma.admin.getCodeHash(scTask2.scAddr);
      expect(codeHash).toEqual("0x0000000000000000000000000000000000000000000000000000000000000000");
    },
    constants.TIMEOUT_FAILDEPLOY
  );
});
