pragma solidity ^0.4.24;

import "./Ownable.sol";

/** @title ERC20 extended token */
contract MultiSigWallet is Ownable {

  modifier ownerExists(address _owner) {
      require(owners[_owner], "Address is not an Owner")
      _;
  }

  modifier transactionExists(uint _transactionId) {
      require(
        transactions[transactionId].destination != 0,
        "Transaction to confirm does not exist"
      )
      _;
  }


  uint numberOfOwners = 3;
  uint numberOfConfirmations = 2;
  mapping(address => bool) owners;
  address masterKey;

  struct Transaction {
    address destination;
    uint value;
    bytes data;
    bool executed;
  }

  mapping(uint => Transaction) transactions;
  uint transactionIndex = 1;

  constructor(address[] _owners, address _masterKey) {
    require(address.length == numberOfOwners, "Too many owner addresses");
    for(uint i=0; i < numberOfOwners; i++) {
      owners[_owners[i]] = true;
    }
    masterKey = _masterKey;
  }

  function submitTransaction(address _destination, uint _value, bytes _data) {
    transactionId = addTransaction(_destination, _value, _data);
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
          executed: false
      });
      transactionIndex += 1;
      //Submission(transactionId);
  }

  function confirmTransaction(uint _transactionId)
      public
      ownerExists(msg.sender)
      transactionExists(transactionId)
      notConfirmed(transactionId, msg.sender)
  {
      confirmations[transactionId][msg.sender] = true;
      //Confirmation(msg.sender, transactionId);
      executeTransaction(transactionId);
  }

  function executeTransaction(uint transactionId)
      public
      notExecuted(transactionId)
  {
      if (isConfirmed(transactionId)) {
          Transaction tx = transactions[transactionId];
          tx.executed = true;
          if (tx.destination.call.value(tx.value)(tx.data))
              Execution(transactionId);
          else {
              ExecutionFailure(transactionId);
              tx.executed = false;
          }
      }
  }

}
