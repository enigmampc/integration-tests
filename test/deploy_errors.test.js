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
    "constructor signature isn't exists",
    async () => {
      /*
        TODO fix a bug in core
        This deployment task becomes ETH_STATUS_CREATED then ETH_STATUS_VERIFIED (See the ENUM at: https://github.com/enigmampc/enigma-contract/blob/08346f20aad4ff7377a7ff1f737e9a3ab76d0c04/enigma-js/src/emitterConstants.js#L47-L52)
        Usually a successful  task is ETH_STATUS_CREATED then ETH_STATUS_VERIFIED
        Usually a failed      task is ETH_STATUS_CREATED then ETH_STATUS_FAILED
      */
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/calculator.wasm"),
        "non-existing construct()",
        [],
        4000000
      );
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it.skip(
    "constructor signature is a regular function",
    async () => {
      /*
        TODO fix a bug in core
        This deployment task becomes ETH_STATUS_CREATED then ETH_STATUS_VERIFIED (See the ENUM at: https://github.com/enigmampc/enigma-contract/blob/08346f20aad4ff7377a7ff1f737e9a3ab76d0c04/enigma-js/src/emitterConstants.js#L47-L52)
        Usually a successful  task is ETH_STATUS_CREATED then ETH_STATUS_VERIFIED
        Usually a failed      task is ETH_STATUS_CREATED then ETH_STATUS_FAILED
      */
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/calculator.wasm"),
        "sub(uint256,uint256)",
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        4000000
      );
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it.skip(
    "constructor signature args are wrong",
    async () => {
      /*
        TODO fix a bug in core
        This deployment task becomes ETH_STATUS_CREATED then ETH_STATUS_VERIFIED (See the ENUM at: https://github.com/enigmampc/enigma-contract/blob/08346f20aad4ff7377a7ff1f737e9a3ab76d0c04/enigma-js/src/emitterConstants.js#L47-L52)
        Usually a successful  task is ETH_STATUS_CREATED then ETH_STATUS_VERIFIED
        Usually a failed      task is ETH_STATUS_CREATED then ETH_STATUS_FAILED
      */
      await testDeployFailureHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/erc20.wasm"),
        "construct()", // should be construct(bytes32,uint256)
        [
          [76, "uint256"],
          [17, "uint256"]
        ],
        4000000
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
