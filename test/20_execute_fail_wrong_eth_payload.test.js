/* eslint-disable require-jsdoc */
const fs = require("fs");
const Web3 = require("web3");
import { Enigma, utils, eeConstants } from "./enigmaLoader";
import {
  VotingETHContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr,
  VotingETHContractAddress
} from "./contractLoader";
import * as constants from "./testConstants";

/**
 * Be sure to run this after 02_deploy_voting.spec
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Enigma tests", () => {
  let accounts;
  let web3;
  let enigma;
  let votingETHContract;
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

  it("initializes VotingETH contract", async () => {
    votingETHContract = new enigma.web3.eth.Contract(VotingETHContract["abi"], VotingETHContractAddress);
    expect(votingETHContract.options.address).toBeTruthy();
  });

  const votingAddr = fs.readFileSync("/tmp/enigma/addr-voting.txt", "utf-8");

  let task1;
  const addr1 = "0x0000000000000000000000000000000000000000000000000000000000000001";
  it("should fail to execute compute task: voter 1 casting vote", async () => {
    const pollId = (await votingETHContract.methods.getPolls().call()).length - 1;
    // there is no function signature cast_vote_bad, should be cast_vote, thus this is an incorrect payload
    let taskFn = "cast_vote_bad(uint256,bytes32,uint256)";
    let taskArgs = [
      [pollId, "uint256"],
      [addr1, "bytes32"],
      [1, "uint256"]
    ];
    let taskGasLimit = 1000000;
    let taskGasPx = utils.toGrains(1);
    task1 = await new Promise((resolve, reject) => {
      enigma
        .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, accounts[0], votingAddr, contants.RETRIES_COMPUTE)
        .on(eeConstants.SEND_TASK_INPUT_RESULT, result => resolve(result))
        .on(eeConstants.ERROR, error => reject(error));
    });
  });

  it("should get the pending task", async () => {
    task1 = await enigma.getTaskRecordStatus(task1);
    expect(task1.ethStatus).toEqual(1);
  });

  it(
    "should get the confirmed task failure (ENG)",
    async () => {
      do {
        await sleep(1000);
        task1 = await enigma.getTaskRecordStatus(task1);
        process.stdout.write("Waiting. Current Task Status is " + task1.ethStatus + "\r");
      } while (task1.ethStatus !== 3);
      expect(task1.ethStatus).toEqual(3);
      process.stdout.write("Completed. Final Task Status is " + task1.ethStatus + "\n");
    },
    constants.TIMEOUT_COMPUTE_LONG
  );
});
