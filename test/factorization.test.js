const path = require("path");
const fs = require("fs");
const axios = require("axios");
const Web3 = require("web3");
const { Enigma } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeHelper, sleep } = require("../scUtils");

describe("factorization", () => {
  let accounts;
  let web3;
  let enigma;

  beforeAll(async () => {
    web3 = new Web3(new Web3.providers.HttpProvider(ethNodeAddr));
    accounts = await web3.eth.getAccounts();

    try {
      const { data } = await axios.get(`${ethNodeAddr.replace(":9545", "")}:8001/faucet/ether?account=${accounts[0]}`);
      console.log("Adding ETH to client successful:", data);
    } catch (e) {
      console.log("Error Adding ETH to client:", e);
    }

    enigma = new Enigma(web3, EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, {
      gas: 4712388,
      gasPrice: 100000000000,
      from: accounts[0]
    });
    enigma.admin();
    enigma.setTaskKeyPair("cupcake");
    expect(Enigma.version()).toEqual("0.0.1");
  }, 30000);

  let scAddr;
  try {
    scAddr = fs.readFileSync(".scAddr", "utf8");
    console.log("Already deployed on", scAddr);
  } catch (e) {
    console.log("Not deployed. Deploying...");
  }

  if (!scAddr) {
    it(
      "deploy",
      async () => {
        const deployTask = await testDeployHelper(
          enigma,
          accounts[0],
          path.resolve(__dirname, "../secretContracts/factorization.wasm")
        );
        scAddr = deployTask.scAddr;

        fs.writeFileSync(".scAddr", scAddr, "utf8");

        await sleep(30 * 1000);
      },
      constants.TIMEOUT_DEPLOY + 30 * 1000
    );
  }

  it(
    "find_number_of_prime_factors(8972)",
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
