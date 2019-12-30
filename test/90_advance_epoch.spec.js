/* eslint-disable require-jsdoc */
import fs from "fs";
import os from "os";
import path from "path";
import Web3 from "web3";
import { Enigma, eeConstants } from "./enigmaLoader";
import {
  EnigmaContract,
  EnigmaTokenContract,
  SampleContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr
} from "./contractLoader";
import * as constants from "./testConstants";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Init tests", () => {
  let accounts;
  let web3;
  let enigma;
  let sampleContract;
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
      expect(Enigma.version()).toEqual("0.0.1");
    });
  });

  it(
    "should move forward to the beginning of next epoch by calling dummy contract",
    async () => {
      const homedir = os.homedir();
      const sampleAddr = fs.readFileSync(path.join(homedir, ".enigma", "addr-sample.txt"), "utf-8");
      const sampleContract = new enigma.web3.eth.Contract(SampleContract["abi"], sampleAddr);
      const currentBlock = await enigma.web3.eth.getBlockNumber();
      const firstBlock = parseInt(await enigma.enigmaContract.methods.getFirstBlockNumber(currentBlock).call());
      const epochSize = parseInt(await enigma.enigmaContract.methods.getEpochSize().call());
      const epochRemains = firstBlock + epochSize - currentBlock;
      for (let i = 0; i < epochRemains; i++) {
        await sampleContract.methods.incrementCounter().send({ from: accounts[8] });
      }
      // Wait for 2s for the Ppal node to pick up the new epoch
      await sleep(3000);
    },
    constants.TIMEOUT_ADVANCE
  );
});
