const fs = require("fs");
const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants, utils } = require("./enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("./contractLoader");
const constants = require("./testConstants");
const ec = new require("elliptic").ec("secp256k1");

const { deploy, testComputeHelper, sleep } = require("./scUtils");

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

  it(
    "deploy",
    async () => {
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

      const deployTask = await deploy(enigma, accounts[0], path.resolve(__dirname, "secretContracts/erc20.wasm"), [
        [addr0, "bytes32"],
        [1000000, "uint256"]
      ]);

      scAddr = deployTask.scAddr;
      fs.writeFileSync("tmp/enigma/addr-erc20.txt", scAddr, "utf8");

      while (true) {
        const { ethStatus } = await enigma.getTaskRecordStatus(deployTask);
        if (ethStatus == eeConstants.ETH_STATUS_VERIFIED) {
          break;
        }

        expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
        await sleep(1000);
      }

      const isDeployed = await enigma.admin.isDeployed(deployTask.scAddr);
      expect(isDeployed).toEqual(true);

      const codeHash = await enigma.admin.getCodeHash(deployTask.scAddr);
      expect(codeHash).toBeTruthy();
    },
    constants.TIMEOUT_DEPLOY
  );
});
