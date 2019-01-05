const chaiAsPromised = require("chai-as-promised");
const chai = require("chai");

chai.use(chaiAsPromised);
const expect = chai.expect;

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
  const ETH_TO_TRANSFER = 5000000000000000;
  const ETH_TO_WITHDRAW = 5000000000000000;
  const TX_ID = 1;

  before("Contracts instances", async () => {
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

      it("should revert if not Token Owner", async () => {

        await expect(
          ERC20.mint(
            MultiSigWallet.address,
            MINTED_TOKENS,
            {from: MASTER_KEY}
          )
        ).to.eventually.be.rejectedWith("revert");
      });
    });
  });

  describe("Transfer ETH to account", () => {
    describe("#submitTransaction (OWNER_1)", () => {
      it("should submit and confirm a transaction", async () => {
        await MultiSigWallet.submitTransaction(
          MASTER_KEY,
          ETH_TO_TRANSFER,
          0,
          {from: OWNER_1}
        );

        const transaction = await MultiSigWallet.transactions(TX_ID);
        const confirmation = await MultiSigWallet.transactionConfirmedBy(TX_ID, OWNER_1);

        assert.deepEqual(
          [
            MASTER_KEY,
            web3.toBigNumber(ETH_TO_TRANSFER),
            "0x",
            false,
            web3.toBigNumber(1)
          ],
          transaction,
           "Transaction is not recorded properly"
        );

        assert.equal(true, confirmation, "Transaction is not confirmed properly")
      });
    });

    describe("#confirmTransaction (OWNER_1)", () => {
      it("should revert because transaction already confirmed by him", async () => {
        await expect(
          MultiSigWallet.confirmTransaction(
            TX_ID,
            {from: OWNER_1}
          )
        ).to.eventually.be.rejectedWith("revert");
      });
    });

    describe("#confirmTransaction (OWNER_2)", () => {
      it("should confirm and execute the transaction", async () => {
        const initialMasterKeyBalance = web3.eth.getBalance(MASTER_KEY);

        await MultiSigWallet.confirmTransaction(
          TX_ID,
          {from: OWNER_2}
        );

        const finalMasterKeyBalance = web3.eth.getBalance(MASTER_KEY);

        const transaction = await MultiSigWallet.transactions(TX_ID);
        const confirmation = await MultiSigWallet.transactionConfirmedBy(TX_ID, OWNER_2);

        assert.deepEqual(
          [
            MASTER_KEY,
            web3.toBigNumber(ETH_TO_TRANSFER),
            "0x",
            true,
            web3.toBigNumber(2)
          ],
          transaction,
           "Transaction is not executed properly"
        );

        assert.equal(true, confirmation, "Transaction is not confirmed properly");

        assert.equal(
          finalMasterKeyBalance - initialMasterKeyBalance,
          ETH_TO_TRANSFER,
          "MASTER_KEY did not receive the ETH"
        );
      });
    });

    describe("#confirmTransaction (OWNER_3)", () => {
      it("should revert because transaction already executed", async () => {
        await expect(
          MultiSigWallet.confirmTransaction(
            TX_ID,
            {from: OWNER_3}
          )
        ).to.eventually.be.rejectedWith("revert");
      });
    });
  });

  describe("Withdraw ETH from MultiSigWallet", () => {
    describe("#withdrawBalance (MASTER_KEY)", () => {
      it("should withdraw the amount of ETH", async () => {
        const initialWalletBalance = web3.eth.getBalance(MultiSigWallet.address);

        await MultiSigWallet.withdrawBalance(
          ETH_TO_WITHDRAW,
          {from: MASTER_KEY}
        );

        const finalWalletBalance = web3.eth.getBalance(MultiSigWallet.address);
        const expectedFinalWalletBalance = initialWalletBalance - ETH_TO_WITHDRAW;

        assert.equal(
          finalWalletBalance.toNumber(),
          expectedFinalWalletBalance,
          "MASTER_KEY did not withdraw the amount of ETH properly"
        );
      });
    });

    describe("#withdrawBalance (OWNER_1)", () => {
      it("should revert because not MASTER_KEY", async () => {
        await expect(
          MultiSigWallet.withdrawBalance(
            ETH_TO_WITHDRAW,
            {from: OWNER_1}
          )
        ).to.eventually.be.rejectedWith("revert");
      });
    });
  });
});
