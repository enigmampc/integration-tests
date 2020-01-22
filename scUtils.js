const fs = require("fs");
const { utils, eeConstants } = require("./enigmaLoader");
const constants = require("./testConstants");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports.sleep = sleep;

function deploy(
  enigma,
  account,
  wasmPathOrBuffer,
  scTaskArgs = [],
  scTaskGasLimit = 4000000,
  scTaskFn = "construct()"
) {
  const scTaskGasPx = utils.toGrains(1);
  const preCode = typeof wasmPathOrBuffer === "string" ? fs.readFileSync(wasmPathOrBuffer) : wasmPathOrBuffer;

  return new Promise((resolve, reject) => {
    enigma
      .deploySecretContract(
        scTaskFn,
        scTaskArgs,
        scTaskGasLimit,
        scTaskGasPx,
        account,
        preCode,
        constants.RETRIES_DEPLOY
      )
      .on(eeConstants.DEPLOY_SECRET_CONTRACT_RESULT, resolve)
      .on(eeConstants.ERROR, reject);
  });
}
module.exports.deploy = deploy;

function compute(enigma, account, scAddr, taskFn, taskArgs, taskGasLimit = 20000000) {
  const taskGasPx = utils.toGrains(1);

  return new Promise((resolve, reject) => {
    enigma
      .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, account, scAddr, constants.RETRIES_COMPUTE)
      .on(eeConstants.SEND_TASK_INPUT_RESULT, resolve)
      .on(eeConstants.ERROR, reject);
  });
}
module.exports.compute = compute;

module.exports.testComputeHelper = async function(
  enigma,
  account,
  scAddr,
  taskFn,
  taskArgs,
  decryptedOutputTester,
  taskGasLimit = 20000000
) {
  const computeTask = await compute(enigma, account, scAddr, taskFn, taskArgs, taskGasLimit);

  await testTaskFinalStatus(enigma, computeTask, eeConstants.ETH_STATUS_VERIFIED);

  const computeTaskResult = await new Promise((resolve, reject) => {
    enigma
      .getTaskResult(computeTask)
      .on(eeConstants.GET_TASK_RESULT_RESULT, resolve)
      .on(eeConstants.ERROR, reject);
  });
  expect(computeTaskResult.engStatus).toEqual("SUCCESS");
  expect(computeTaskResult.encryptedAbiEncodedOutputs).toBeTruthy();

  const decryptedTaskResult = await enigma.decryptTaskResult(computeTaskResult);
  expect(decryptedTaskResult.usedGas).toBeTruthy();
  expect(decryptedTaskResult.workerTaskSig).toBeTruthy();

  await decryptedOutputTester(decryptedTaskResult.decryptedOutput);
};

module.exports.testComputeFailureHelper = async function(
  enigma,
  account,
  scAddr,
  taskFn,
  taskArgs,
  expectedEthStatus,
  decryptedOutputTester,
  taskGasLimit = 20000000
) {
  const computeTask = await compute(enigma, account, scAddr, taskFn, taskArgs, taskGasLimit);

  await testTaskFinalStatus(enigma, computeTask, expectedEthStatus);

  const computeTaskResult = await new Promise((resolve, reject) => {
    enigma
      .getTaskResult(computeTask)
      .on(eeConstants.GET_TASK_RESULT_RESULT, resolve)
      .on(eeConstants.ERROR, reject);
  });
  if (expectedEthStatus === eeConstants.ETH_STATUS_FAILED_ETH) {
    expect(computeTaskResult.engStatus).toEqual(null);
  } else {
    expect(computeTaskResult.engStatus).toEqual("FAILED");
  }
  expect(computeTaskResult.encryptedAbiEncodedOutputs).toBeTruthy();

  const decryptedTaskResult = await enigma.decryptTaskResult(computeTaskResult);
  expect(decryptedTaskResult.usedGas).toBeTruthy();
  expect(decryptedTaskResult.workerTaskSig).toBeTruthy();

  await decryptedOutputTester(decryptedTaskResult.decryptedOutput);
};

module.exports.testDeployHelper = async function(
  enigma,
  account,
  wasmPathOrBuffer,
  scTaskArgs = [],
  scTaskFn = "construct()",
  gasLimit = 4000000
) {
  const deployTask = await deploy(enigma, account, wasmPathOrBuffer, scTaskArgs, gasLimit, scTaskFn);

  await testTaskFinalStatus(enigma, deployTask, eeConstants.ETH_STATUS_VERIFIED);

  const isDeployed = await enigma.admin.isDeployed(deployTask.scAddr);
  expect(isDeployed).toEqual(true);

  const codeHash = await enigma.admin.getCodeHash(deployTask.scAddr);
  expect(codeHash).toBeTruthy();

  return deployTask;
};

const ethStatusCodeToName = {
  0: "ETH_STATUS_UNDEFINED",
  1: "ETH_STATUS_CREATED",
  2: "ETH_STATUS_VERIFIED",
  3: "ETH_STATUS_FAILED",
  4: "ETH_STATUS_FAILED_ETH",
  5: "ETH_STATUS_FAILED_RETURN"
};
const ethStatusNameToCode = {
  ETH_STATUS_UNDEFINED: 0,
  ETH_STATUS_CREATED: 1,
  ETH_STATUS_VERIFIED: 2,
  ETH_STATUS_FAILED: 3,
  ETH_STATUS_FAILED_ETH: 4,
  ETH_STATUS_FAILED_RETURN: 5
};

module.exports.ethStatusCodeToName = ethStatusCodeToName;
module.exports.ethStatusNameToCode = ethStatusNameToCode;

module.exports.testDeployFailureHelper = async function(
  enigma,
  account,
  wasmPathOrBuffer,
  scTaskFn = "construct()",
  scTaskArgs = [],
  gasLimit = 4000000
) {
  const deployTask = await deploy(enigma, account, wasmPathOrBuffer, scTaskArgs, gasLimit, scTaskFn);

  await testTaskFinalStatus(enigma, deployTask, eeConstants.ETH_STATUS_FAILED);

  const isDeployed = await enigma.admin.isDeployed(deployTask.scAddr);
  expect(isDeployed).toEqual(false);

  const codeHash = await enigma.admin.getCodeHash(deployTask.scAddr);
  expect(codeHash).toEqual("0x0000000000000000000000000000000000000000000000000000000000000000");
};

async function testTaskFinalStatus(enigma, task, finalStatus) {
  let { ethStatus } = await enigma.getTaskRecordStatus(task);
  expect(ethStatusCodeToName[ethStatus]).toEqual(ethStatusCodeToName[eeConstants.ETH_STATUS_CREATED]);

  while (true) {
    ({ ethStatus } = await enigma.getTaskRecordStatus(task));
    if (ethStatus !== eeConstants.ETH_STATUS_CREATED) {
      break;
    }
    await sleep(1000);
  }

  expect(ethStatusCodeToName[ethStatus]).toEqual(ethStatusCodeToName[finalStatus]);
}
