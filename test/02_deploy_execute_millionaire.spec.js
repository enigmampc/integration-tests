const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants, utils } = require("./enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("./contractLoader");
const constants = require("./testConstants");

const { deploy, testComputeHelper, sleep } = require("./scUtils");

describe("millionaire", () => {
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
      const deployTask = await deploy(enigma, accounts[0], path.resolve(__dirname, "secretContracts/millionaire.wasm"));
      scAddr = deployTask.scAddr;
      fs.writeFileSync("/tmp/enigma/addr-millionaire.txt", deployTask.scAddr, "utf8");

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

  const millionaire1 = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const millionaire2 = "0x0000000000000000000000000000000000000000000000000000000000000002";

  it(
    "computeTask add_millionaire",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "add_millionaire(bytes32,uint256)",
        [
          [millionaire1, "bytes32"],
          [1000000, "uint256"]
        ],
        decryptedOutput => expect(decryptedOutput).toEqual("")
      );
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "add_millionaire(bytes32,uint256)",
        [
          [millionaire2, "bytes32"],
          [2000000, "uint256"]
        ],
        decryptedOutput => expect(decryptedOutput).toEqual("")
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "computeTask compute_richest",
    async () => {
      await testComputeHelper(enigma, accounts[0], scAddr, "compute_richest()", [], decryptedOutput =>
        expect(decryptedOutput).toEqual(utils.remove0x(millionaire2))
      );
    },
    constants.TIMEOUT_COMPUTE
  );
});
