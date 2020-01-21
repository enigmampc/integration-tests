const path = require("path");
const Web3 = require("web3");
const { Enigma } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeHelper } = require("../scUtils");

describe("factorization", () => {
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
      path.resolve(__dirname, "../secretContracts/factorization.wasm")
    );
    scAddr = deployTask.scAddr;
  }, constants.TIMEOUT_DEPLOY);

  it(
    "find_number_of_prime_factors",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "find_number_of_prime_factors(uint64)",
        [[8972, "uint64"]],
        decryptedOutput => expect(parseInt(decryptedOutput, 16)).toEqual(2)
      );
    },
    constants.TIMEOUT_COMPUTE
  );
});
