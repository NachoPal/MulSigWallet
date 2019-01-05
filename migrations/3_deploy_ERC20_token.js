var ERC20 = artifacts.require("./ERC20Detailed.sol");

module.exports = function(deployer) {
  deployer.deploy(
    ERC20,
    "XEN token",
    "XEN",
    18
  );
};
