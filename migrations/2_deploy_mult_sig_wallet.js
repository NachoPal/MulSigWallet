var MultiSigWallet = artifacts.require("./MultiSigWallet.sol");

module.exports = function(deployer) {
  deployer.deploy(
    MultiSigWallet,
    [
      "0x16f1b1cb43c0744f85b52104f6a7c3cc60cd3c49",
      "0xf204b4b3b0a4656e8e818d6c051679162f426999",
      "0x331dc60105e769c2323309dfd73f47228e8005f5"
    ],
    "0x8493484940139e84aa386999c603ad6eb5515eda",
    3,
    2,
    {value: 100000000000000000}
  );
};
