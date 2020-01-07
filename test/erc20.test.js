const path = require("path");
const Web3 = require("web3");
const { Enigma, utils } = require("../enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("../contractLoader");
const constants = require("../testConstants");
const ec = new (require("elliptic").ec)("secp256k1");
const BN = require("bn.js");
const EthCrypto = require("eth-crypto");

const { testDeployHelper, testComputeHelper } = require("../scUtils");

describe("erc20", () => {
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

  beforeEach(async () => {
    const account_zero_private_key = "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
    const keyPair0 = ec.keyFromPrivate(account_zero_private_key);
    const addr0 = web3.utils.keccak256(
      new Buffer.from(
        keyPair0
          .getPublic()
          .encode("hex")
          .substring(2),
        "hex"
      )
    );

    // Sanity Checks
    expect(keyPair0.getPrivate().toString(16)).toEqual(account_zero_private_key);
    expect(addr0.slice(-40)).toString(utils.remove0x(accounts[0]));

    const deployTask = await testDeployHelper(
      enigma,
      accounts[0],
      path.resolve(__dirname, "../secretContracts/erc20.wasm"),
      [
        [addr0, "bytes32"],
        [1000000, "uint256"]
      ],
      "construct(bytes32,uint256)"
    );
    scAddr = deployTask.scAddr;
  }, constants.TIMEOUT_DEPLOY);

  it(
    "computeTask mint",
    async () => {
      const amount = 100000;
      const account_zero_private_key = "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
      const account_one_private_key = "6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1";
      const keyPair0 = ec.keyFromPrivate(account_zero_private_key);
      const keyPair1 = ec.keyFromPrivate(account_one_private_key);
      const addr0 = web3.utils.keccak256(
        new Buffer.from(
          keyPair0
            .getPublic()
            .encode("hex")
            .substring(2),
          "hex"
        )
      );
      const addr1 = web3.utils.keccak256(
        new Buffer.from(
          keyPair1
            .getPublic()
            .encode("hex")
            .substring(2),
          "hex"
        )
      );

      // Sanity Checks
      expect(keyPair0.getPrivate().toString(16)).toEqual(account_zero_private_key);
      expect(keyPair1.getPrivate().toString(16)).toEqual(account_one_private_key);
      expect(addr0.slice(-40)).toString(utils.remove0x(accounts[0]));
      expect(addr1.slice(-40)).toString(utils.remove0x(accounts[1]));

      const msg = utils.hash([addr1, new BN(amount).toString(16, 16)]);
      const sig = EthCrypto.sign(account_zero_private_key, msg);

      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "mint(bytes32,bytes32,uint256,bytes)",
        [
          [addr0, "bytes32"],
          [addr1, "bytes32"],
          [amount, "uint256"],
          [sig, "bytes"]
        ],
        decryptedOutput => expect(decryptedOutput).toEqual("")
      );
    },
    constants.TIMEOUT_COMPUTE_LONG
  );
});
