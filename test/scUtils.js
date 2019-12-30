const fs = require("fs");
const { utils, eeConstants } = require("./enigmaLoader");
const constants = require("./testConstants");

module.exports.deploy = function(
  enigma,
  account,
  contractWasmPath,
  scTaskFn = "construct()",
  scTaskArgs = "",
  scTaskGasLimit = 1000000
) {
  const scTaskGasPx = utils.toGrains(1);
  const preCode = fs.readFileSync(contractWasmPath);

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
};

module.exports.compute = function(enigma, account, scAddr, taskFn, taskArgs, taskGasLimit = 1000000) {
  const taskGasPx = utils.toGrains(1);

  return new Promise((resolve, reject) => {
    enigma
      .computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, account, scAddr, constants.RETRIES_COMPUTE)
      .on(eeConstants.SEND_TASK_INPUT_RESULT, resolve)
      .on(eeConstants.ERROR, reject);
  });
};
