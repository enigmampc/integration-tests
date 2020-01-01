const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { deploy, testComputeHelper, sleep } = require("../scUtils");

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
      fs.writeFileSync("/tmp/enigma/addr-calculator.txt", scAddr, "utf8");

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

  it(
    "computeTask sub",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "sub(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        decryptedOutput => expect(parseInt(decryptedOutput, 16)).toEqual(76 - 17)
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "computeTask mul",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "mul(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        decryptedOutput => expect(parseInt(decryptedOutput, 16)).toEqual(76 * 17)
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "computeTask add",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "add(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        decryptedOutput => expect(parseInt(decryptedOutput, 16)).toEqual(76 + 17)
      );
    },
    constants.TIMEOUT_COMPUTE
  );
});
