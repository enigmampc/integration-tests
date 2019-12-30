const path = require("path");
const Web3 = require("web3");
const { Enigma, utils, eeConstants } = require("./enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("./contractLoader");
const constants = require("./testConstants");

const { deploy, compute } = require("./scUtils");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("calculator", () => {
  let accounts;
  let web3;
  let enigma;
  let scAddr;

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

  it(
    "deploy",
    async () => {
      const deployTask = await deploy(enigma, accounts[0], path.resolve(__dirname, "secretContracts/calculator.wasm"));

      scAddr = deployTask.scAddr;

      while (true) {
        const { ethStatus } = await enigma.getTaskRecordStatus(deployTask);
        if (ethStatus == eeConstants.ETH_STATUS_VERIFIED) {
          break;
        }

        expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
        await sleep(1000);
      }

      const isDeployed = await enigma.admin.isDeployed(deployTask.scAddr);
      expect(isDeployed).toEqual(true);

      const codeHash = await enigma.admin.getCodeHash(deployTask.scAddr);
      expect(codeHash).toBeTruthy();
    },
    constants.TIMEOUT_DEPLOY
  );

  async function testComputeHelper(taskFn, taskArgs, expectedResult) {
    const computeTask = await compute(enigma, accounts[0], scAddr, taskFn, taskArgs);

    const { ethStatus } = await enigma.getTaskRecordStatus(computeTask);
    expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);

    while (true) {
      const { ethStatus } = await enigma.getTaskRecordStatus(computeTask);
      if (ethStatus == eeConstants.ETH_STATUS_VERIFIED) {
        break;
      }

      expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
      await sleep(1000);
    }

    const computeTaskResult = await new Promise((resolve, reject) => {
      enigma
        .getTaskResult(computeTask)
        .on(eeConstants.GET_TASK_RESULT_RESULT, resolve)
        .on(eeConstants.ERROR, reject);
    });
    expect(computeTaskResult.engStatus).toEqual("SUCCESS");
    expect(computeTaskResult.encryptedAbiEncodedOutputs).toBeTruthy();

    const decryptedTaskResult = await enigma.decryptTaskResult(computeTaskResult);
    expect(decryptedTaskResult.usedGas).toBeTruthy();
    expect(decryptedTaskResult.workerTaskSig).toBeTruthy();
    expect(parseInt(decryptedTaskResult.decryptedOutput, 16)).toEqual(expectedResult);
  }

  it(
    "computeTask sub",
    async () => {
      await testComputeHelper(
        "sub(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        76 - 17
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "computeTask mul",
    async () => {
      await testComputeHelper(
        "mul(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        76 * 17
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "computeTask add",
    async () => {
      await testComputeHelper(
        "add(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        76 + 17
      );
    },
    constants.TIMEOUT_COMPUTE
  );
});
