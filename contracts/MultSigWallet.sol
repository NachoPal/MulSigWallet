pragma solidity ^0.4.24;

import "./Mixins/Pausable.sol";
import "./Token/IERC20.sol";

/** @title MultiSigWallet. */
contract MultiSigWallet is Pausable {

    //---- MODIFERS

    /** @dev Check if an address is 0x0.
     *  @param _address Address to be checked.
     */
    modifier notNull(address _address) {
        require(
          address(_address) != address(0),
          "Address can not be 0x0"
        );
        _;
      }

    /** @dev Check if an address is the MasterKey.
     *  @param _address Address to be checked.
     */
    modifier isMasterKey(address _address) {
        require(
            _address == masterKey,
            "Address is not Master Key"
        );
        _;
    }

    /** @dev Check if an address is an Owner allowed to confirm txs.
     *  @param _owner Address of the owner to be checked.
     */
    modifier ownerExists(address _owner) {
        require(
            owners[_owner],
            "Address is not an Owner"
        );
        _;
    }

    /** @dev Check if a Transaction already exist.
     *  @param _transactionId ID to be checked.
     */
    modifier transactionExists(uint _transactionId) {
        require(
            transactions[_transactionId].destination != 0,
            "Transaction to confirm does not exist"
        );
        _;
    }

    /** @dev Check if a Transaction is not yet confirmed.
     *  @param _transactionId ID to be checked.
     */
    modifier transactionNotConfirmed(uint _transactionId, address _sender) {
        require(
            transactions[_transactionId].confirmations[_sender] == false,
            "Transaction already confirm by owner"
        );
        _;
    }

    /** @dev Check if a Transaction is not yet executed.
     *  @param _transactionId ID to be checked.
     */
    modifier transactionNotExecuted(uint _transactionId) {
        require(
            transactions[_transactionId].executed == false,
            "Transaction already executed"
        );
        _;
    }

    //---- EVENTS

    /** @dev Event to log a Token is added.
     *  @param tokenAddress Address of the ERC20 to add support.
     *  @param masterKey Address approved to make token tx on behalf of the wallet.
     */
    event TokenAdded(
        address indexed tokenAddress,
        address indexed masterKey
    );

    /** @dev Event to log a Transaction is submitted to be confirmed.
     *  @param transactionId ID of transactions that has been submitted.
     *  @param submitter Address of the owner who submitted the tx.
     */
    event Submission(
        uint indexed transactionId,
        address indexed submitter
    );

    /** @dev Event to log a Transaction has been confirmed.
     *  @param transactionId ID of transactions that has been confirmed.
     *  @param confirmer Address of the owner who confirmed the tx.
     */
    event Confirmation(
        uint indexed transactionId,
        address indexed confirmer
    );

    /** @dev Event to log a Transaction has been executed.
     *  @param transactionId ID of transactions that has been executed.
     *  @param executor Address of the owner who executed the tx.
     */
    event Execution(
        uint indexed transactionId,
        address indexed executor
    );

    /** @dev Event to log a Transaction has failed when executed.
     *  @param transactionId ID of transactions that has been executed.
     *  @param executor Address of the owner who executed the tx.
     */
    event ExecutionFailure(
        uint indexed transactionId,
        address indexed executor
    );

    /** @dev Event to log a Deposit has been made.
     *  @param sender Address of the sender of the deposit.
     *  @param value Value deposited.
     */
    event Deposit(
        address indexed sender,
        uint value
    );

    /** @dev Event to log a Deposit has been made.
     *  @param sender Address who withdraws the amount.
     *  @param amount Amount withdrawn.
     */
    event Withdrawal(
        address indexed sender,
        uint amount
    );

    /** @dev Event to log MasterKey has been transferred.
     *  @param newMasterKey Address of the new MasterKey.
     *  @param oldMasterKey Address of the old MasterKey.
     */
    event MasterKeyTransferred(
        address indexed newMasterKey,
        address indexed oldMasterKey
    );

    //---- STORAGE VARIABLES

    uint public numberOfOwners;
    uint public numberOfConfirmations;
    mapping(address => bool) public owners;
    address public masterKey;

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        bool executed;
        uint confirmationsCounter;
        mapping(address => bool) confirmations;
    }

    mapping(uint => Transaction) public transactions;
    uint public transactionIndex;

    /** @dev Constructor: Initialize contract
     *  @param _owners Array of owner address allowed to submit, confirm and execute tx
     *  @param _masterKey Address of the masterKey
     *  @param _numberOfOwners Max number of owners
     *  @param _numberOfConfirmations Min number of confirmations
     */
    constructor(
        address[] _owners,
        address _masterKey,
        uint _numberOfOwners,
        uint _numberOfConfirmations
    )
        public
        payable
        notNull(_masterKey)
    {
        require(
            _owners.length == _numberOfOwners,
            "Too many owners to initialize"
        );

        require(
            _numberOfOwners >= _numberOfConfirmations,
            "Too many owner confirmations"
        );

        for(uint i=0; i < _numberOfOwners; i++) {
          require(
            address(_owners[i]) != address(0),
            "Address can not be 0x0"
          );
            owners[_owners[i]] = true;
        }

        numberOfOwners = _numberOfOwners;
        numberOfConfirmations = _numberOfConfirmations;
        masterKey = _masterKey;
        transactionIndex = 1;
    }

    //---- EXTERNAL functions

    /** @dev Add ERC20 to allow masterKey to tranfer tokens on behalf of Wallet
     *  @param _address Address of the ERC20 token
     *  @param _value Value to be approved to be handle be masterKey
     */
    function addERC20token(address _address, uint _value)
        external
        onlyOwner
        whenNotPaused
    {
        IERC20(_address).approve(masterKey, _value);
        emit TokenAdded(_address, masterKey);
    }

    /** @dev Submit transaction to be confirmed and eventually executed
     *  @param _destination Address of EOA or Contract to send the tx
     *  @param _value Value to send in tx
     *  @param _data Data to send in tx
     */
    function submitTransaction(address _destination, uint _value, bytes _data)
        external
        whenNotPaused
        ownerExists(msg.sender)
    {
        uint transactionId = addTransaction(_destination, _value, _data);
        confirmTransaction(transactionId);
    }

    /** @dev Withdrawal function for masterKey
     *  @param _amount Amount to be withdrawn
     */
    function withdrawBalance(uint _amount)
        external
        isMasterKey(msg.sender)
    {
        require(
            address(this).balance >= _amount,
            "Wallet does not have enough funds to withdraw"
        );

        address(msg.sender).transfer(_amount);
        emit Withdrawal(msg.sender, _amount);
    }

    /** @dev Destruct contract and send balance to the owner.
     */
    function kill() external onlyOwner {
        selfdestruct(owner());
    }

    //---- PUBLIC functions

    /** @dev Custom getter to read confirmation mapping inside Transaction struct
     *  @param _transactionId ID of the tx to check confirmations by owner
     *  @param _owner Address of the owner to check if had confirmed tx
     */
    function transactionConfirmedBy(uint _transactionId, address _owner)
        public
        view
        returns(bool)
    {
        return transactions[_transactionId].confirmations[_owner];
    }

    /** @dev Confirm Transaction by one owner. It makes sure that the owner
     *  exists, the tx, tx has not been executed yet, and not confirmed by the
     *  same owner.
     *  @param _transactionId ID of the tx to be confirmed
     */
    function confirmTransaction(uint _transactionId)
        public
        whenNotPaused
        ownerExists(msg.sender)
        transactionExists(_transactionId)
        transactionNotExecuted(_transactionId)
        transactionNotConfirmed(_transactionId, msg.sender)
    {
        transactions[_transactionId].confirmations[msg.sender] = true;
        transactions[_transactionId].confirmationsCounter += 1;

        emit Confirmation(_transactionId, msg.sender);

        if(transactions[_transactionId].confirmationsCounter == numberOfConfirmations) {
            executeTransaction(_transactionId);
        }
    }

    /** @dev Change the address of the masterKey. Only Wallet owner can change it
     *  @param _newMasterKey Address of the new masterKey
     */
    function changeMasterKey(address _newMasterKey)
        public
        onlyOwner
        notNull(_newMasterKey)
    {
        require(
            _newMasterKey != masterKey,
            "New master key can not be the same"
        );
        address oldMasterKey = masterKey;
        masterKey = _newMasterKey;
        emit MasterKeyTransferred(masterKey, oldMasterKey);
    }

    /** @dev Fallback to receive ETH
     */
    function()
        public
        payable
        whenNotPaused
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

    //---- INTERNAL functions

    /** @dev Add Transaction to mapping to track it and know its state
     *  @param _destination Address of EOA or Contract to send the tx
     *  @param _value Value to send in tx
     *  @param _data Data to send in tx
     */
    function addTransaction(address _destination, uint _value, bytes _data)
        internal
        returns (uint transactionId)
    {
        transactionId = transactionIndex;
        transactions[transactionId] = Transaction({
            destination: _destination,
            value: _value,
            data: _data,
            executed: false,
            confirmationsCounter: 0
        });
        transactionIndex += 1;
        emit Submission(transactionId, msg.sender);
    }

    /** @dev Execute Transaction when number of needed confirmations have
     *  been reached
     *  @param _transactionId ID of tx to be executed
     */
    function executeTransaction(uint _transactionId)
        internal
    {
          Transaction storage trx = transactions[_transactionId];
          trx.executed = true;
          if (address(trx.destination).call.value(trx.value)(trx.data))
              emit Execution(_transactionId, msg.sender);
          else {
              emit ExecutionFailure(_transactionId, msg.sender);
          }
    }
}
