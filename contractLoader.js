const EnigmaTokenContract = require("../build/contracts/EnigmaToken");
const VotingETHContract = require("../build/contracts/VotingETH");
const SampleContract = require("../build/contracts/Sample");

require("dotenv").config();

let EnigmaContract = null;
if (typeof process.env.SGX_MODE !== "undefined" && process.env.SGX_MODE == "SW") {
  EnigmaContract = require("../build/contracts/EnigmaSimulation");
} else {
  EnigmaContract = require("../build/contracts/Enigma");
}

let EnigmaContractAddress = null;
let EnigmaTokenContractAddress = null;
let proxyAddress = null;
let ethNodeAddr = null;
let VotingETHContractAddress = null;
let SampleContractAddress = null;

if (typeof process.env.ENIGMA_ENV !== "undefined" && process.env.ENIGMA_ENV !== "LOCAL") {
  const addrs = JSON.parse(
    require("fs").readFileSync(require("path").resolve(__dirname, "../build/contracts/addresses.json"))
  );
  EnigmaContractAddress = addrs["contract"];
  EnigmaTokenContractAddress = addrs["token"];
  proxyAddress = addrs["proxy"];
  ethNodeAddr = addrs["eth_node"];
  if (process.env.ENIGMA_ENV === "COMPOSE") {
    VotingETHContractAddress = addrs["voting"];
    SampleContractAddress = addrs["sample"];
  }
} else {
  EnigmaContractAddress = EnigmaContract.networks["4447"].address;
  EnigmaTokenContractAddress = EnigmaTokenContract.networks["4447"].address;
  proxyAddress = "http://localhost:3346";
  ethNodeAddr = "http://localhost:9545";
  VotingETHContractAddress = VotingContract.networks["4447"].address;
  SampleContractAddress = SampleConctract.networks["4447"].address;
}

module.exports = {
  EnigmaContract,
  EnigmaTokenContract,
  SampleContract,
  VotingETHContract,
  EnigmaContractAddress,
  EnigmaTokenContractAddress,
  proxyAddress,
  ethNodeAddr,
  VotingETHContractAddress,
  SampleContractAddress
};