const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, utils, eeConstants, Task } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const EthCrypto = require("eth-crypto");
const EventEmitter = require("eventemitter3");
const constants = require("../testConstants");
const { sleep, ethStatusNameToCode } = require("../scUtils");

describe("Fail to deploy because of wrong worker", () => {
  let accounts;
  let web3;
  let enigma;
  let workerAddress;
  beforeAll(() => {
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

  function createWrongWorkerTask(fn, args, gasLimit, gasPx, sender, scAddrOrPreCode, isContractDeploymentTask) {
    const emitter = new EventEmitter();
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

      let wrongWorkerAddress = workerParams.workers.filter(function(value, index, arr) {
        return value != workerAddress;
      })[0];

      wrongWorkerAddress = wrongWorkerAddress.toLowerCase().slice(-40); // remove leading '0x' if present
      const { publicKey, privateKey } = enigma.obtainTaskKeyPair(sender, nonce);
      try {
        const getWorkerEncryptionKeyResult = await new Promise((resolve, reject) => {
          enigma.client.request(
            "getWorkerEncryptionKey",
            { workerAddress: wrongWorkerAddress, userPubKey: publicKey },
            (err, response) => (err ? reject(err) : resolve(response))
          );
        });
        const { result, id } = getWorkerEncryptionKeyResult;
        const { workerEncryptionKey, workerSig } = result;

        // The signature of the workerEncryptionKey is generated
        // concatenating the following elements in a bytearray:
        // len('Enigma User Message') + b'Enigma User Message' + len(workerEncryptionKey) + workerEncryptionKey
        // Because the first 3 elements are constant, they are hardcoded as follows:
        // len('Enigma User Message') as a uint64 => 19 in hex => 0000000000000013
        // bytes of 'Enigma User Message' in hex => 456e69676d612055736572204d657373616765
        // len(workerEncryptionKey) as a unit64 => 64 in hex => 0000000000000040
        const hexToVerify =
          "0x0000000000000013456e69676d612055736572204d6573736167650000000000000040" + workerEncryptionKey;

        // the hashing function soliditySha3 expects hex instead of bytes
        let recAddress = EthCrypto.recover(
          "0x" + workerSig,
          enigma.web3.utils.soliditySha3({ t: "bytes", value: hexToVerify })
        );

        recAddress = recAddress.toLowerCase().slice(-40); // remove leading '0x' if present

        if (wrongWorkerAddress !== recAddress) {
          console.error("Worker address", wrongWorkerAddress, "!= recovered address", recAddress);
          emitter.emit(eeConstants.ERROR, {
            name: "InvalidWorker",
            message: `Invalid worker encryption key + signature combo ${wrongWorkerAddress} != ${recAddress}`
          });
        } else {
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
              wrongWorkerAddress,
              workerEncryptionKey,
              sender,
              userTaskSig,
              nonce,
              preCodeGzip.toString("base64"),
              preCodeHash,
              isContractDeploymentTask
            )
          );
        }
      } catch (err) {
        emitter.emit(eeConstants.ERROR, err);
      }
    })();
    return emitter;
  }

  it(
    "should fail to deploy because of wrong worker",
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
            createWrongWorkerTask(scTaskFn, scTaskArgs, scTaskGasLimit, scTaskGasPx, accounts[0], preCode, true)
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

      let i = 0;
      do {
        await sleep(1000);
        scTask2 = await enigma.getTaskRecordStatus(scTask2);
        i++;
      } while (scTask2.ethStatus === ethStatusNameToCode["ETH_STATUS_CREATED"] && i < 6);
      expect(scTask2.ethStatus).toEqual(ethStatusNameToCode["ETH_STATUS_CREATED"]);

      const isDeployed = await enigma.admin.isDeployed(scTask2.scAddr);
      expect(isDeployed).toEqual(false);

      const codeHash = await enigma.admin.getCodeHash(scTask2.scAddr);
      expect(codeHash).toEqual("0x0000000000000000000000000000000000000000000000000000000000000000");
    },
    constants.TIMEOUT_FAILDEPLOY
  );
});
