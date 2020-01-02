const path = require("path");
const Web3 = require("web3");
const { Enigma, utils } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeHelper } = require("../scUtils");

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
      const deployTask = await testDeployHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/millionaire.wasm")
      );
      scAddr = deployTask.scAddr;
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
        decryptedOutput => expect(decryptedOutput).toEqual("") /* void */
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
        decryptedOutput => expect(decryptedOutput).toEqual("") /* void */
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
