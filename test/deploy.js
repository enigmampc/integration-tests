const fs = require("fs");
const { utils, eeConstants } = require("./enigmaLoader.js");
const constants = require("./testConstants");

module.exports.deploy = function(enigma, account, contractWasmPath) {
  const scTaskFn = "construct()";
  const scTaskArgs = "";
  const scTaskGasLimit = 1000000;
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
