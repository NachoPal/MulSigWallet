const chaiAsPromised = require("chai-as-promised");
const chai = require("chai");
const txHelper = require('./helpers/transactions');
const getTxData = txHelper.getTxData;
const getAbiByFunctionNames = txHelper.getAbiByFunctionNames;

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

  const MINTED_TOKENS = 10;
  const TOKEN_TO_TRANSFER = 5;
  const TOKEN_TO_APPROVE = 5;
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

    describe("#addERC20token", () => {
      it("should approve MASTER_KEY as spender of MultiSigWallet balance & LOG recorded", async () => {
        await MultiSigWallet.addERC20token(
          ERC20.address,
          TOKEN_TO_APPROVE,
          {from: WALLET_OWNER}
        );

        const allowance = await ERC20.allowance(
          MultiSigWallet.address,
          MASTER_KEY
        );

        assert.equal(allowance, TOKEN_TO_APPROVE, "Tokens allowance was not approved properly");

        //TOKEN_ADDED LOG
        const logs = await web3.eth.getPastLogs({
          fromBlock: 1,
          address: MultiSigWallet.address,
          topics: [
            web3.eth.abi.encodeEventSignature(
              getAbiByFunctionNames(MultiSigWallet.abi)["TokenAdded"]
            )
          ]
        });

        const decodedLogs = web3.eth.abi.decodeLog(
          getAbiByFunctionNames(MultiSigWallet.abi)["TokenAdded"].inputs,
          logs[0].data,
          _.drop(logs[0].topics)
        );

        assert.deepEqual(
          {
            tokenAddress: decodedLogs.tokenAddress,
            masterKey: decodedLogs.masterKey
          },
          {
            tokenAddress: ERC20.address,
            masterKey: MASTER_KEY
          },
          "TokenAdded Event not emitted properly"
        );
      });
    });
  });

  describe("Transfer ETH to account", () => {
    describe("#submitTransaction (OWNER_1)", () => {
      it("should submit and confirm a transaction & LOG recorded", async () => {
        await MultiSigWallet.submitTransaction(
          MASTER_KEY,
          ETH_TO_TRANSFER,
          "0x0",
          {from: OWNER_1}
        );

        const transaction = await MultiSigWallet.transactions(TX_ID);
        const confirmation = await MultiSigWallet.transactionConfirmedBy(TX_ID, OWNER_1);

        assert.deepEqual(
          {
            destination: MASTER_KEY,
            value: web3.utils.toBN(ETH_TO_TRANSFER),
            data: "0x00",
            executed: false,
            confirmationsCounter: web3.utils.toBN(1)
          },
          {
            destination: transaction.destination,
            value: transaction.value,
            data: transaction.data,
            executed: transaction.executed,
            confirmationsCounter: transaction.confirmationsCounter
          },
           "Transaction is not recorded properly"
        );

        assert.equal(true, confirmation, "Transaction is not confirmed properly")

        //SUBMISSION LOG
        var logs = await web3.eth.getPastLogs({
          fromBlock: 1,
          address: MultiSigWallet.address,
          topics: [
            web3.eth.abi.encodeEventSignature(
              getAbiByFunctionNames(MultiSigWallet.abi)["Submission"]
            )
          ]
        });

        var decodedLogs = web3.eth.abi.decodeLog(
          getAbiByFunctionNames(MultiSigWallet.abi)["Submission"].inputs,
          logs[0].data,
          _.drop(logs[0].topics)
        );

        assert.deepEqual(
          {
            transactionId: Number(decodedLogs.transactionId),
            submitter: decodedLogs.submitter
          },
          {
            transactionId: TX_ID,
            submitter: OWNER_1
          },
          "Submission Event not emitted properly"
        );

        //CONFIRMATION LOG
        var logs = await web3.eth.getPastLogs({
          fromBlock: 1,
          address: MultiSigWallet.address,
          topics: [
            web3.eth.abi.encodeEventSignature(
              getAbiByFunctionNames(MultiSigWallet.abi)["Confirmation"]
            )
          ]
        });

        var decodedLogs = web3.eth.abi.decodeLog(
          getAbiByFunctionNames(MultiSigWallet.abi)["Confirmation"].inputs,
          logs[0].data,
          _.drop(logs[0].topics)
        );

        assert.deepEqual(
          {
            transactionId: Number(decodedLogs.transactionId),
            confirmer: decodedLogs.confirmer
          },
          {
            transactionId: TX_ID,
            confirmer: OWNER_1
          },
          "Confirmation Event not emitted properly"
        );
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
        const initialMasterKeyBalance = await web3.eth.getBalance(MASTER_KEY);

        await MultiSigWallet.confirmTransaction(
          TX_ID,
          {from: OWNER_2}
        );

        const finalMasterKeyBalance = await web3.eth.getBalance(MASTER_KEY);

        const transaction = await MultiSigWallet.transactions(TX_ID);
        const confirmation = await MultiSigWallet.transactionConfirmedBy(TX_ID, OWNER_2);

        assert.deepEqual(
          {
            destination: MASTER_KEY,
            value: web3.utils.toBN(ETH_TO_TRANSFER),
            data: "0x00",
            executed: true,
            confirmationsCounter: web3.utils.toBN(2)
          },
          {
            destination: transaction.destination,
            value: transaction.value,
            data: transaction.data,
            executed: transaction.executed,
            confirmationsCounter: transaction.confirmationsCounter
          },
           "Transaction is not executed properly"
        );

        assert.equal(true, confirmation, "Transaction is not confirmed properly");

        assert.equal(
          finalMasterKeyBalance - initialMasterKeyBalance,
          ETH_TO_TRANSFER,
          "MASTER_KEY did not receive the ETH"
        );

        //EXECUTION LOG
        var logs = await web3.eth.getPastLogs({
          fromBlock: 1,
          address: MultiSigWallet.address,
          topics: [
            web3.eth.abi.encodeEventSignature(
              getAbiByFunctionNames(MultiSigWallet.abi)["Execution"]
            )
          ]
        });

        var decodedLogs = web3.eth.abi.decodeLog(
          getAbiByFunctionNames(MultiSigWallet.abi)["Execution"].inputs,
          logs[0].data,
          _.drop(logs[0].topics)
        );

        assert.deepEqual(
          {
            transactionId: Number(decodedLogs.transactionId),
            executor: decodedLogs.executor
          },
          {
            transactionId: TX_ID,
            executor: OWNER_2
          },
          "Execution Event not emitted properly"
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
      it("should withdraw the amount of ETH & LOG recorded", async () => {
        const initialWalletBalance = await web3.eth.getBalance(MultiSigWallet.address);

        await MultiSigWallet.withdrawBalance(
          ETH_TO_WITHDRAW,
          {from: MASTER_KEY}
        );

        const finalWalletBalance = await web3.eth.getBalance(MultiSigWallet.address);
        const expectedFinalWalletBalance = initialWalletBalance - ETH_TO_WITHDRAW;

        assert.equal(
          finalWalletBalance,
          expectedFinalWalletBalance,
          "MASTER_KEY did not withdraw the amount of ETH properly"
        );

        //WITHDRAWAL LOG
        var logs = await web3.eth.getPastLogs({
          fromBlock: 1,
          address: MultiSigWallet.address,
          topics: [
            web3.eth.abi.encodeEventSignature(
              getAbiByFunctionNames(MultiSigWallet.abi)["Withdrawal"]
            )
          ]
        });

        var decodedLogs = web3.eth.abi.decodeLog(
          getAbiByFunctionNames(MultiSigWallet.abi)["Withdrawal"].inputs,
          logs[0].data,
          _.drop(logs[0].topics)
        );

        assert.deepEqual(
          {
            sender: decodedLogs.sender,
            amount: Number(decodedLogs.amount)
          },
          {
            sender: MASTER_KEY,
            amount: ETH_TO_WITHDRAW
          },
          "Withdrawal Event not emitted properly"
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
  describe("Interact with ERC20 token", () => {
    describe("#transfer to OWNER_1", () => {
      it("OWNER_1 should own new tokens", async () => {

        const data = getTxData({
          abi: ERC20.abi,
          functionName: "transfer",
          arguments: {to: OWNER_1, value: TOKEN_TO_TRANSFER},
        });

        //OWNER_1 submit and confirm transaction
        await MultiSigWallet.submitTransaction(
          ERC20.address,
          0,
          data,
          {from: OWNER_1}
        );

        //OWNER_2 confirms and executes transaction
        await MultiSigWallet.confirmTransaction(
          TX_ID + 1,
          {from: OWNER_2}
        );

        const balance = await ERC20.balanceOf(OWNER_1);

        assert.equal(balance, TOKEN_TO_TRANSFER, "Tokens were not transfered properly");
      });
    });

    describe("#transferFrom MASTER_KEY (no confirmation needed) to MASTER_KEY", () => {
      it("MASTER_KEY should own new tokens", async () => {
        await ERC20.transferFrom(
          MultiSigWallet.address,
          MASTER_KEY,
          TOKEN_TO_APPROVE,
          {from: MASTER_KEY}
        );

        const balance = await ERC20.balanceOf(MASTER_KEY);

        assert.equal(balance, TOKEN_TO_APPROVE, "Tokens were not transfered properly");
      });
    });
  });
});
