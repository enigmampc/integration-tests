const path = require("path");
const Web3 = require("web3");
const { Enigma } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeHelper } = require("../scUtils");

describe("calculator", () => {
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

  let scAddr;
  beforeEach(async () => {
    const deployTask = await testDeployHelper(
      enigma,
      accounts[0],
      path.resolve(__dirname, "../secretContracts/calculator.wasm")
    );
    scAddr = deployTask.scAddr;
  }, constants.TIMEOUT_DEPLOY);

  it(
    "sub",
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
    "mul",
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
    "add",
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
