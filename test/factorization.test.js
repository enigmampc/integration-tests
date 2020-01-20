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
      const input = 8972;
      const expectedOutput = Array.from(new Set(findPrimeFactors(input))).length;

      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "find_number_of_prime_factors(uint64)",
        [[input, "uint64"]],
        decryptedOutput => expect(parseInt(decryptedOutput, 16)).toEqual(expectedOutput)
      );
    },
    constants.TIMEOUT_COMPUTE
  );
});

// https://js-algorithms.tutorialhorizon.com/2015/09/27/find-all-the-prime-factors-for-the-given-number/
function findPrimeFactors(num) {
  const primeFactors = [];
  while (num % 2 === 0) {
    primeFactors.push(2);
    num = num / 2;
  }

  const sqrtNum = Math.sqrt(num);
  for (var i = 3; i <= sqrtNum; i++) {
    while (num % i === 0) {
      primeFactors.push(i);
      num = num / i;
    }
  }

  if (num > 2) {
    primeFactors.push(num);
  }
  return primeFactors;
}
