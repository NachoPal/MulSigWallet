const MultiSigWalletArtifacts = artifacts.require("MultiSigWallet");
const ERC20Artifacts = artifacts.require("ERC20Detailed");

contract('MultiSigWallet', (ACCOUNTS) => {

  const TOKEN_OWNER = ACCOUNTS[0];
  const WALLET_OWNER = ACCOUNTS[0];
  const MASTER_KEY = ACCOUNTS[4];
  const OWNER_1 = ACCOUNTS[1];
  const OWNER_2 = ACCOUNTS[2];
  const OWNER_3 = ACCOUNTS[3];

  let MultiSigWallet;
  let ERC20;

  // const MultiSigWallet = await MultiSigWalletArtifacts.deployed();
  // const ERC20 = await ERC20Artifacts.deployed();

  const MINTED_TOKENS = 10;

  before("Get contracts instances", async () => {
    MultiSigWallet = await MultiSigWalletArtifacts.deployed();
    ERC20 = await ERC20Artifacts.deployed();
  });

  describe("Setup", () => {
    describe("#mint", () => {
      it("should increment token balance of MultiSigWallet contract", async () => {
        await ERC20.mint(
          MultiSigWallet.address,
          MINTED_TOKENS,
          {from: TOKEN_OWNER}
        );

        const balance = await ERC20.balanceOf(MultiSigWallet.address);

        assert.equal(balance, MINTED_TOKENS, "Tokens were not mint properly");
      });
    });
  });
});
