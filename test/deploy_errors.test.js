const path = require("path");
const Web3 = require("web3");
const { Enigma, utils, eeConstants } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { deploy, sleep, testDeployFailureHelper } = require("../scUtils");

describe("deploy errors", () => {
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
    "bad bytecode",
    async () => {
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        Buffer.from("5468697369736e6f746170726f706572736563726574636f6e74726163742e456e69676d6172756c65732e", "hex")
      );
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it(
    "out of gas",
    async () => {
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/calculator.wasm"),
        "constructor()",
        [],
        1
      );
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it.skip(
    "bad constructor name",
    async () => {
      // TODO fix
      // this passes but very weird
      // why it is verified then created?!?!
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/calculator.wasm"),
        "not a valid construct()",
        [],
        4000000,
        eeConstants.ETH_STATUS_VERIFIED,
        eeConstants.ETH_STATUS_CREATED
      );
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it(
    "bad constructor arguments",
    async () => {
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/voting.wasm"),
        "construct()",
        [] // expecting one argument of type address
      );
    },
    constants.TIMEOUT_FAILDEPLOY
  );
});
