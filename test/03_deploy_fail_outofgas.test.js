/* eslint-disable require-jsdoc */
const fs = require("fs");
import os from "os";
const path = require("path");
const Web3 = require("web3");
import { Enigma, utils, eeConstants } from "../enigmaLoader";
import {
  EnigmaContract,
  EnigmaTokenContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr
} from "../contractLoader";
import * as constants from "./testConstants";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Enigma tests", () => {
  let accounts;
  let web3;
  let enigma;
  let epochSize;
  it("initializes", () => {
    const provider = new Web3.providers.HttpProvider(ethNodeAddr);
    web3 = new Web3(provider);
    return web3.eth.getAccounts().then(result => {
      accounts = result;
      enigma = new Enigma(web3, EnigmaContractAddress, EnigmaTokenContractAddress, proxyAddress, {
        gas: 4712388,
        gasPrice: 100000000000,
        from: accounts[0]
      });
      enigma.admin();
      enigma.setTaskKeyPair("cupcake");
      expect(Enigma.version()).toEqual("0.0.1");
    });
  });

  let scTask3;
  const homedir = os.homedir();

  it(
    "should deploy secret contract",
    async () => {
      let scTaskFn = "construct()";
      let scTaskArgs = [];
      let scTaskGasLimit = 1;
      let scTaskGasPx = utils.toGrains(1);
      let preCode;
      try {
        preCode = fs.readFileSync(path.resolve(__dirname, "../secretContracts/calculator.wasm"));
      } catch (e) {
        console.log("Error:", e.stack);
      }
      scTask3 = await new Promise((resolve, reject) => {
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
          .on(eeConstants.DEPLOY_SECRET_CONTRACT_RESULT, receipt => resolve(receipt))
          .on(eeConstants.ERROR, error => reject(error));
      });
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it(
    "should get the failed receipt",
    async () => {
      do {
        await sleep(1000);
        scTask3 = await enigma.getTaskRecordStatus(scTask3);
        process.stdout.write("Waiting. Current Task Status is " + scTask3.ethStatus + "\r");
      } while (scTask3.ethStatus != 3);
      expect(scTask3.ethStatus).toEqual(3);
      process.stdout.write("Completed. Final Task Status is " + scTask3.ethStatus + "\n");
    },
    constants.TIMEOUT_FAILDEPLOY
  );

  it("should fail to verify deployed contract", async () => {
    const result = await enigma.admin.isDeployed(scTask3.scAddr);
    expect(result).toEqual(false);
  });

  it("should fail to get deployed contract bytecode hash", async () => {
    const result = await enigma.admin.getCodeHash(scTask3.scAddr);
    expect(result).toBeFalsy;
  });
});
