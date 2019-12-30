/* eslint-disable require-jsdoc */
const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma } = require("./enigmaLoader.js");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("./contractLoader.js");
const constants = require("./testConstants.js");

const { deploy } = require("./deploy.js");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Enigma tests", () => {
  let accounts;
  let web3;
  let enigma;

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
    "should deploy secret contract",
    async () => {
      const scTask = await deploy(enigma, accounts[0], path.resolve(__dirname, "secretContracts/millionaire.wasm"));

      fs.writeFileSync("/tmp/enigma/addr-millionaire.txt", scTask.scAddr, "utf8");

      let scTaskStatus;
      while (true) {
        scTaskStatus = await enigma.getTaskRecordStatus(scTask);
        if (scTaskStatus.ethStatus == 2) {
          break;
        }
        await sleep(1000);
      }
      expect(scTaskStatus.ethStatus).toEqual(2);

      const isDeployed = await enigma.admin.isDeployed(scTask.scAddr);
      expect(isDeployed).toEqual(true);

      const codeHash = await enigma.admin.getCodeHash(scTask.scAddr);
      expect(codeHash).toBeTruthy();
    },
    constants.TIMEOUT_DEPLOY
  );
});
