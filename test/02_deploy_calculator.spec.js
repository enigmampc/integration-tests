/* eslint-disable require-jsdoc */
import fs from "fs";
import os from "os";
import path from "path";
import Web3 from "web3";
import { Enigma, utils, eeConstants } from "./enigmaLoader";
import { EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, ethNodeAddr } from "./contractLoader";
import * as constants from "./testConstants";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Enigma tests", () => {
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
    "should deploy secret contract",
    async () => {
      const scTaskFn = "construct()";
      const scTaskArgs = "";
      const scTaskGasLimit = 1000000;
      const scTaskGasPx = utils.toGrains(1);
      const preCode = fs.readFileSync(path.resolve(__dirname, "secretContracts/calculator.wasm"));

      const scTask = await new Promise((resolve, reject) => {
        enigma
          .deploySecretContract(
            scTaskFn,
            scTaskArgs,
            scTaskGasLimit,
            scTaskGasPx,
            accounts[0],
            preCode,
            constants.RETRIES_DEPLOY
          )
          .on(eeConstants.DEPLOY_SECRET_CONTRACT_RESULT, resolve)
          .on(eeConstants.ERROR, reject);
      });

      fs.writeFileSync(path.join(os.homedir(), ".enigma", "addr-calculator.txt"), scTask.scAddr, "utf8");

      let scTaskStatus;
      while (true) {
        scTaskStatus = await enigma.getTaskRecordStatus(scTask);
        if (scTaskStatus.ethStatus == 2) {
          break;
        }
        await sleep(1000);
      }
      expect(scTaskStatus.ethStatus).toEqual(2);

      const isDeployed = await enigma.admin.isDeployed(scTask.scAddr);
      expect(isDeployed).toEqual(true);

      const codeHash = await enigma.admin.getCodeHash(scTask.scAddr);
      expect(codeHash).toBeTruthy();
    },
    constants.TIMEOUT_DEPLOY
  );
});
