const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeHelper, testComputeFailureHelper } = require("../scUtils");

describe("constructor_set_state_12", () => {
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
      path.resolve(__dirname, "../secretContracts/constructor_set_state_12.wasm")
    );
    scAddr = deployTask.scAddr;
  }, constants.TIMEOUT_DEPLOY);

  it(
    "computeTask get_last_sum should return sum=12 after it was set in the conctructor",
    async () => {
      // sum is set to 12 in the constructor:
      // https://github.com/enigmampc/enigma-core/blob/56a4ec7e6c8ad2f0a3149238250fdeed2f1043dd/examples/eng_wasm_contracts/contract_with_eth_calls/src/lib.rs#L61-L62
      await testComputeHelper(enigma, accounts[0], scAddr, "get_last_sum()", [], decryptedOutput =>
        expect(parseInt(decryptedOutput, 16)).toEqual(12)
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "computeTask failure sum_and_call",
    async () => {
      await testComputeFailureHelper(
        enigma,
        accounts[0],
        scAddr,
        "sum_and_call(uint256,uint256,address)",
        [
          [2, "uint256"],
          [3, "uint256"],
          // the address argument must be an existing contract address, otherwise this test that is supposed to fail
          // will always succeed in Ganache.
          // Using EnigmaContractAddress as long as it never has a function called 'record()'
          [EnigmaContractAddress, "address"]
        ],
        eeConstants.ETH_STATUS_FAILED_ETH,
        decryptedOutput => expect(parseInt(decryptedOutput, 16)).toEqual(5)
      );

      // We changed sum to 5 but then got an error on the ethereum callback
      // So the state will be reverted back to sum=12

      await testComputeHelper(enigma, accounts[0], scAddr, "get_last_sum()", [], decryptedOutput =>
        expect(parseInt(decryptedOutput, 16)).toEqual(12)
      );
    },
    constants.TIMEOUT_COMPUTE
  );
});
