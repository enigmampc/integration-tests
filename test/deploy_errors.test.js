const Web3 = require("web3");
const { Enigma, utils, eeConstants } = require("./enigmaLoader");
const { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } = require("./contractLoader");
const constants = require("./testConstants");

const { deploy, testComputeHelper, sleep } = require("./scUtils");

describe("deploy errors", () => {
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
    "bad bytecode",
    async () => {
      const deployTask = await deploy(
        enigma,
        accounts[0],
        Buffer.from("5468697369736e6f746170726f706572736563726574636f6e74726163742e456e69676d6172756c65732e", "hex")
      );

      while (true) {
        const { ethStatus } = await enigma.getTaskRecordStatus(deployTask);
        if (ethStatus == eeConstants.ETH_STATUS_VERIFIED) {
          break;
        }

        expect(ethStatus).toEqual(eeConstants.ETH_STATUS_FAILED);
        await sleep(1000);
      }

      const isDeployed = await enigma.admin.isDeployed(deployTask.scAddr);
      expect(isDeployed).toEqual(false);

      const codeHash = await enigma.admin.getCodeHash(deployTask.scAddr);
      expect(codeHash).toBeFalsy();
    },
    constants.TIMEOUT_FAILDEPLOY
  );
});
