/* eslint-disable require-jsdoc */
const fs = require("fs");
import os from "os";
const path = require("path");
const Web3 = require("Web3");
import { Enigma, utils, eeConstants } from "./enigmaLoader";
import elliptic from "elliptic";
import {
  EnigmaContract,
  EnigmaTokenContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr
} from "./contractLoader";
import * as constants from "./testConstants";

let ec = new elliptic.ec("secp256k1");

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

  let scTask;
  let task;
  const homedir = os.homedir();

  it(
    "should deploy secret contract",
    async () => {
      let scTaskFn = "construct()";
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

      let scTaskArgs = [
        [addr0, "bytes32"],
        [1000000, "uint256"]
      ];
      let scTaskGasLimit = 4000000;
      let scTaskGasPx = utils.toGrains(1);
      let preCode;
      try {
        preCode = fs.readFileSync(path.resolve(__dirname, "secretContracts/erc20.wasm"));
      } catch (e) {
        console.log("Error:", e.stack);
      }
      scTask = await new Promise((resolve, reject) => {
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

      fs.writeFile(path.join(homedir, ".enigma", "addr-erc20.txt"), scTask.scAddr, "utf8", function(err) {
        if (err) {
          return console.log(err);
        }
      });
    },
    constants.TIMEOUT_DEPLOY
  );

  it(
    "should get the confirmed deploy contract task",
    async () => {
      do {
        await sleep(1000);
        scTask = await enigma.getTaskRecordStatus(scTask);
        process.stdout.write("Waiting. Current Task Status is " + scTask.ethStatus + "\r");
      } while (scTask.ethStatus != 2);
      expect(scTask.ethStatus).toEqual(2);
      process.stdout.write("Completed. Final Task Status is " + scTask.ethStatus + "\n");
    },
    constants.TIMEOUT_DEPLOY
  );

  it("should verify deployed contract", async () => {
    const result = await enigma.admin.isDeployed(scTask.scAddr);
    expect(result).toEqual(true);
  });

  it("should get deployed contract bytecode hash", async () => {
    const result = await enigma.admin.getCodeHash(scTask.scAddr);
    expect(result).toBeTruthy;
    console.log("Deployed contract bytecode hash is: " + result);
  });
});
