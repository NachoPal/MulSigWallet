pragma solidity ^0.4.24;
//pragma experimental ABIEncoderV2;

import "./Mixins/Ownable.sol";
import "./Token/IERC20.sol";

/** @title ERC20 extended token */
contract MultiSigWallet is Ownable {

  event TokenAdded(
      address indexed tokenAddress,
      string indexed tokenType
  );

  event Submission(
    uint indexed transactionId,
    address indexed submitter
  );

  event Confirmation(
    uint indexed transactionId,
    address indexed confirmer
  );

  event Execution(uint indexed transactionId);
  event ExecutionFailure(uint indexed transactionId);

  event Deposit(address indexed sender, uint value);

  modifier isMasterKey(address _address) {
    require(
        _address == masterKey,
        "Address is not Master Key"
    );
    _;
  }

  modifier ownerExists(address _owner) {
      require(owners[_owner], "Address is not an Owner");
      _;
  }

  modifier transactionExists(uint _transactionId) {
      require(
        transactions[_transactionId].destination != 0,
        "Transaction to confirm does not exist"
      );
      _;
  }

  modifier transactionNotConfirmed(uint _transactionId, address _sender) {
      require(
        transactions[_transactionId].confirmations[_sender] == false,
        "Transaction already confirm by owner"
        );
      _;
  }

  modifier transactionNotExecuted(uint _transactionId) {
      require(
          transactions[_transactionId].executed == false,
          "Transaction already executed"
      );
      _;
  }

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
  uint transactionIndex = 1;

  constructor(
    address[] _owners,
    address _masterKey,
    uint _numberOfOwners,
    uint _numberOfConfirmations
  )
    payable
  {
    require(_owners.length == _numberOfOwners, "Too many owners to initialize");
    require(_numberOfOwners >= _numberOfConfirmations, "Too many owner confirmations");
    for(uint i=0; i < _numberOfOwners; i++) {
      owners[_owners[i]] = true;
    }
    numberOfOwners = _numberOfOwners;
    numberOfConfirmations = _numberOfConfirmations;
    masterKey = _masterKey;
  }


  function addERC20token(address _address, uint _value) onlyOwner public {
    IERC20(_address).approve(masterKey, _value);
    emit TokenAdded(_address, "ERC20");
  }


  function transactionConfirmedBy(uint _transactionId, address _owner) public view returns(bool) {
    return transactions[_transactionId].confirmations[_owner];
  }

  function submitTransaction(address _destination, uint _value, bytes _data)
    ownerExists(msg.sender)
    public
  {
    uint transactionId = addTransaction(_destination, _value, _data);
    confirmTransaction(transactionId);
  }

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

  function confirmTransaction(uint _transactionId)
      public
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

  function executeTransaction(uint _transactionId)
      internal
  {
        Transaction storage trx = transactions[_transactionId];
        trx.executed = true;
        if (address(trx.destination).call.value(trx.value)(trx.data))
            emit Execution(_transactionId);
        else {
            emit ExecutionFailure(_transactionId);
        }
  }

  function withdrawBalance(uint _amount)
    isMasterKey(msg.sender)
    external
  {
      require(
        address(this).balance >= _amount,
        "Wallet does not have enough funds to withdraw"
      );
      address(msg.sender).transfer(_amount);
  }

  /// @dev Fallback function allows to deposit ether.
  function()
      payable
  {
      if (msg.value > 0)
          emit Deposit(msg.sender, msg.value);
  }

}
