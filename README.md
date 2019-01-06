IGNACIO PALACIOS SANTOS

# Requirements
  * Truffle 5.0.1 (web3.js 1.0.0)
  * Ganache-cli 6.1.6 (ganache-core: 2.1.5)


# Set Up
  * `$ npm install`
  * `$ npm run chain`
  * `$ npm run test`  


# Assumptions
1. The 3 owners are initialized in the constructor and can not be changed.

2. Owners can not retry to send a failed transaction. They would have to submit a new transactions.

3. Only owners can submit transactions to be confirmed and executed.

4. Only wallet owner can change masterKey address.

5. Only wallet owner can add ERC20 tokens.


# Notes
1. When transaction is executed (message call) `address(trx.destination).call.value(trx.value)(trx.data))` no GAS argument is attached. If `destination` is untrusted, it could lead to the consumption of all the GAS. This situation can be solved easily limiting `gasLimit` param in the transaction to be sign itself. Other option would be to add an attribute `gas` to `Transaction` struct, defining how much from `gasLimit` the owner is willing to use in the message call.

2. Reentrancy attack is not possible because `addTransaction()` is internal.

3. Cross-function Reentrancy attack is not possible because `confirmTransaction()` (which calls `addTransaction()`) can be called only by owners.

4. **SafeMath** library has not been used since there are two cases where a number is added. Both cases are counters that will never reach 2^256, so I considered it was beneficial to save some GAS.

5. Block Gas limit might be reached if `_numberOfOwners`is too high during contract deployment.

6. Addresses of ERC20 tokens are not stored in storage. Addresses stored in the Logs should be enough to allow the user to interact with them. Storing them might be to be considered though, in case of future functionalities.

7. If `masterKey` is changed, the new one will have to add all the tokens again in order to be approved for `transferFrom` on behalf of the **MultiSigWallet** contract.

8. Enough Events are emitted to make possible to interact with the wallet from a UI.

9. Contracts **Ownable.sol** and **Pausable.sol** belongs to OpenZeppelin

10. In a real project for production, what I would have done is **to use one of the MultiSigWallets already available, audited and widely used such as MultiSignWallet from Gnosis** https://github.com/Gnosis/MultiSigWallet .I would have modified it as less as possible if needed. I got inspired by it but decided to create my own in order to show my skills and create a simpler version good enough to fulfill the assignment requirements.


# Enhancements
1. Use a Upgradeability pattern like **Unstructured storage**.

2. Use Security tools and audit the smart contracts.

3. Reach 100% test coverage.

4. Decide what `uint` storage variables can be downgraded to `uint128`, `uint64`, etc.. to be packed wisely in storage and save GAS when SSTORE and SLOAD.

5. Add functionality to add, change and remove owners. It can be easily done adding `function addOwner()`, `function removeOwner()` and `function replaceOwner()` from **MultiSignWallet from Gnosis**.

6. Add more functionalities that can be also found in **MultiSignWallet from Gnosis** such as `function revokeConfirmation()`.
