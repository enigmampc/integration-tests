const path = require("path");
const Web3 = require("web3");
const { Enigma, utils, eeConstants } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeFailureHelper } = require("../scUtils");

describe("execute errors", () => {
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
    "error in ethereum callback",
    async () => {
      const deployTask = await testDeployHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/voting.wasm"),
        [["0x0000000000000000000000000000000000000102", "address"]],
        "construct(address)",
        4000000
      );

      const voter = "0x0000000000000000000000000000000000000000000000000000000000000001";
      const vote = 0;
      const pollId = 0;
      await testComputeFailureHelper(
        enigma,
        accounts[0],
        deployTask.scAddr,
        "cast_vote(uint256,bytes32,uint256)",
        [
          [pollId, "uint256"],
          [voter, "bytes32"],
          [vote, "uint256"]
        ],
        eeConstants.ETH_STATUS_FAILED
      );
    },
    constants.TIMEOUT_DEPLOY
  );
});
