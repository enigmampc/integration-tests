const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants } = require("./enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("./contractLoader");
const constants = require("./testConstants");

const { deploy, testComputeHelper, sleep } = require("./scUtils");

describe("flipcoin", () => {
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
      const deployTask = await deploy(enigma, accounts[0], path.resolve(__dirname, "secretContracts/flipcoin.wasm"));

      scAddr = deployTask.scAddr;
      fs.writeFileSync("/tmp/enigma/addr-flipcoin.txt", deployTask.scAddr, "utf8");

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
    "computeTask flip",
    async () => {
      await testComputeHelper(enigma, accounts[0], scAddr, "flip()", [], decryptedOutput => {
        const result = parseInt(decryptedOutput, 16);
        expect(result === 1 || result === 0).toBe(true);
      });
    },
    constants.TIMEOUT_COMPUTE
  );
});
