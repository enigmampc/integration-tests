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

function compute(enigma, account, scAddr, taskFn, taskArgs, taskGasLimit = 1000000) {
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

  while (true) {
    const { ethStatus } = await enigma.getTaskRecordStatus(computeTask);
    if (ethStatus == eeConstants.ETH_STATUS_VERIFIED) {
      break;
    }

    expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
    await sleep(1000);
  }

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

module.exports.testComputeFailureHelper = async function(enigma, account, scAddr, taskFn, taskArgs, expectedEthStatus) {
  const computeTask = await compute(enigma, account, scAddr, taskFn, taskArgs);

  while (true) {
    const { ethStatus } = await enigma.getTaskRecordStatus(computeTask);
    if (ethStatus == expectedEthStatus) {
      break;
    }

    expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
    await sleep(1000);
  }
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

  scAddr = deployTask.scAddr;

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

  return deployTask;
};

module.exports.testDeployFailureHelper = async function(
  enigma,
  account,
  wasmPathOrBuffer,
  scTaskFn = "construct()",
  scTaskArgs = [],
  gasLimit = 4000000
) {
  const deployTask = await deploy(enigma, account, wasmPathOrBuffer, scTaskArgs, gasLimit, scTaskFn);

  while (true) {
    const { ethStatus } = await enigma.getTaskRecordStatus(deployTask);
    if (ethStatus == eeConstants.ETH_STATUS_FAILED) {
      break;
    }

    expect(ethStatus).toEqual(eeConstants.ETH_STATUS_CREATED);
    await sleep(1000);
  }

  const isDeployed = await enigma.admin.isDeployed(deployTask.scAddr);
  expect(isDeployed).toEqual(false);

  const codeHash = await enigma.admin.getCodeHash(deployTask.scAddr);
  expect(codeHash).toEqual("0x0000000000000000000000000000000000000000000000000000000000000000");
};
