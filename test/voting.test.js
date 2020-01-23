const path = require("path");
const Web3 = require("web3");
const { Enigma, eeConstants } = require("../enigmaLoader");
const {
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr,
  VotingETHContract,
  VotingETHContractAddress
} = require("../contractLoader");
const constants = require("../testConstants");

const { testDeployHelper, testComputeHelper, testComputeFailureHelper, sleep } = require("../scUtils");

describe("voting", () => {
  let accounts;
  let web3;
  let enigma;
  let scAddr; // https://github.com/enigmampc/enigma-core/blob/942f580ee88ecd856bb1209a47cbc29bcdd7111e/examples/eng_wasm_contracts/voting_demo/src/lib.rs
  let VotingSmartContract; // https://github.com/enigmampc/enigma-contract/blob/98204a8027cb1f1472626efa6baf23795e9440c0/contracts/VotingETH.sol

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

    VotingSmartContract = new enigma.web3.eth.Contract(VotingETHContract["abi"], VotingETHContractAddress);
    expect(VotingSmartContract.options.address).toEqual(VotingETHContractAddress);
  });

  it(
    "deploy",
    async () => {
      const deployTask = await testDeployHelper(
        enigma,
        accounts[0],
        path.resolve(__dirname, "../secretContracts/voting.wasm"),
        [[VotingETHContractAddress, "address"]],
        "construct(address)",
        4000000
      );

      scAddr = deployTask.scAddr;
    },
    constants.TIMEOUT_DEPLOY
  );

  let pollId;

  it("create a new poll on Ethereum", async () => {
    // https://github.com/enigmampc/enigma-contract/blob/98204a8027cb1f1472626efa6baf23795e9440c0/contracts/VotingETH.sol#L26-L36
    const beforePollsLength = (await VotingSmartContract.methods.getPolls().call()).length;
    await VotingSmartContract.methods.createPoll(50, "Is privacy important?", 30 /* 30 seconds */).send({
      gas: 4712388,
      gasPrice: 100000000000,
      from: accounts[0]
    });
    const polls = await VotingSmartContract.methods.getPolls().call();
    const AfterPollsLength = polls.length;
    expect(AfterPollsLength - beforePollsLength).toEqual(1);

    pollId = polls.length - 1;
  });

  const addr1 = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const addr2 = "0x0000000000000000000000000000000000000000000000000000000000000002";

  it(
    "addr1 cast_vote",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "cast_vote(uint256,bytes32,uint256)",
        [
          [pollId, "uint256"],
          [addr1, "bytes32"],
          [1, "uint256"]
        ],
        decryptedOutput => expect(decryptedOutput).toEqual("") /* void */
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "addr1 cannot cast_vote more than once",
    async () => {
      await testComputeFailureHelper(
        enigma,
        accounts[0],
        scAddr,
        "cast_vote(uint256,bytes32,uint256)",
        [
          [pollId, "uint256"],
          [addr1, "bytes32"],
          [0, "uint256"]
        ],
        eeConstants.ETH_STATUS_FAILED,
        decryptedOutput =>
          expect(Buffer.from(decryptedOutput, "hex").toString()).toEqual("Error in execution of WASM code: unreachable")
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "addr2 cast_vote",
    async () => {
      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "cast_vote(uint256,bytes32,uint256)",
        [
          [pollId, "uint256"],
          [addr2, "bytes32"],
          [0, "uint256"]
        ],
        decryptedOutput => expect(decryptedOutput).toEqual("") /* void */
      );
    },
    constants.TIMEOUT_COMPUTE
  );

  it(
    "wait for expirationTime then computeTask tally_votes",
    async () => {
      const pollBeforeTally = (await VotingSmartContract.methods.getPolls().call())[pollId];
      expect(pollBeforeTally.status).toEqual("1");
      while (true) {
        if (Date.now() / 1000 > +pollBeforeTally.expirationTime) {
          break;
        }
        await sleep(1000);
        /* 
          TODO?
          Maybe also test for failure in case of tally_poll before expirationTime:
          await testComputeFailureHelper(
            enigma,
            accounts[0],
            scAddr,
            "tally_poll(uint256)",
            [[pollId, "uint256"]],
            eeConstants.ETH_STATUS_FAILED_ETH,
            undefined,
            decryptedOutput => expect(Buffer.from(decryptedOutput, "hex").toString()).toEqual("bla bla")
          );
          But this could take time and mess up the timing of this whole test
          (If expirationTime didn't pass before the call but will pass before a worker
          can handle this request)
        */
      }

      await testComputeHelper(
        enigma,
        accounts[0],
        scAddr,
        "tally_poll(uint256)",
        [[pollId, "uint256"]],
        decryptedOutput => expect(decryptedOutput).toEqual("") /* void */
      );

      const pollAfterTally = (await VotingSmartContract.methods.getPolls().call())[pollId];
      expect(pollAfterTally.status).toEqual("2");
    },
    30000 /* poll expiration is 30sec */ + constants.TIMEOUT_COMPUTE
  );
});
