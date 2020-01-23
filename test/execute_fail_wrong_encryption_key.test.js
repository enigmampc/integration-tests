const path = require("path");
const Web3 = require("web3");
const { Enigma, utils, eeConstants, Task } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const EventEmitter = require("eventemitter3");
const constants = require("../testConstants");
const { sleep, ethStatusNameToCode, testDeployHelper } = require("../scUtils");

describe("Fail to execute because of wrong encryption key", () => {
  let workerAddress;
  let accounts;
  let web3;
  let enigma;
  let calculatorAddr;

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

    const deployTask = await testDeployHelper(
      enigma,
      accounts[0],
      path.resolve(__dirname, "../secretContracts/calculator.wasm")
    );
    calculatorAddr = deployTask.scAddr;
  }, constants.TIMEOUT_DEPLOY);

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
            (err, response) => (err ? reject(err) : resolve(response))
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

  it(
    "should fail executing compute task with wrong encryption keys",
    async () => {
      const taskFn = "sub(uint256,uint256)";
      const taskArgs = [
        [76, "uint256"],
        [17, "uint256"]
      ];
      const taskGasLimit = 100000;
      const taskGasPx = utils.toGrains(1);

      let task = await new Promise((resolve, reject) => {
        createWrongEncryptionKeyTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], calculatorAddr, false)
          .on(eeConstants.CREATE_TASK, resolve)
          .on(eeConstants.ERROR, reject);
      });
      task = await new Promise((resolve, reject) => {
        enigma
          .createTaskRecord(task)
          .on(eeConstants.CREATE_TASK_RECORD, resolve)
          .on(eeConstants.ERROR, reject);
      });
      await new Promise((resolve, reject) => {
        enigma
          .sendTaskInput(task)
          .on(eeConstants.SEND_TASK_INPUT_RESULT, resolve)
          .on(eeConstants.ERROR, reject);
      });

      task = await enigma.getTaskRecordStatus(task);
      expect(task.ethStatus).toEqual(ethStatusNameToCode["ETH_STATUS_CREATED"]);

      do {
        await sleep(1000);
        task = await enigma.getTaskRecordStatus(task);
      } while (task.ethStatus !== ethStatusNameToCode["ETH_STATUS_FAILED"]);
      expect(task.ethStatus).toEqual(ethStatusNameToCode["ETH_STATUS_FAILED"]);

      task = await new Promise((resolve, reject) => {
        enigma
          .getTaskResult(task)
          .on(eeConstants.GET_TASK_RESULT_RESULT, resolve)
          .on(eeConstants.ERROR, reject);
      });
      expect(task.engStatus).toEqual("FAILED");
      expect(task.encryptedAbiEncodedOutputs).toBeTruthy();
      expect(task.workerTaskSig).toBeTruthy();

      try {
        await enigma.decryptTaskResult(task);
        expect(false).toBeTruthy();
      } catch (err) {
        expect(err.message).toEqual("decipher did not finish");
      }
    },
    constants.TIMEOUT_COMPUTE
  );
});
