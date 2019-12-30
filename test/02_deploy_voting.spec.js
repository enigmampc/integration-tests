/* eslint-disable require-jsdoc */
const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants } = require("./enigmaLoader");
const {
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr,
  VotingETHContract,
  VotingETHContractAddress
} = require("./contractLoader");
const constants = require("./testConstants");

const { deploy } = require("./scUtils");

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
      const { options } = new enigma.web3.eth.Contract(VotingETHContract["abi"], VotingETHContractAddress);
      expect(options.address).toEqual(VotingETHContractAddress);

      const deployTask = await deploy(
        enigma,
        accounts[0],
        path.resolve(__dirname, "secretContracts/voting.wasm"),
        "construct(address)",
        [[VotingETHContractAddress, "address"]],
        4000000
      );

      fs.writeFileSync("/tmp/enigma/addr-voting.txt", deployTask.scAddr, "utf8");

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
});
