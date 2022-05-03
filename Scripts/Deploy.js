console.clear();
require("dotenv").config();
const {
  Client,
  AccountId,
  PrivateKey,
  TransferTransaction,
  TokenCreateTransaction,
  FileCreateTransaction,
  FileAppendTransaction,
  ContractCreateTransaction,
  ContractFunctionParameters,
  ContractCallQuery,
  TokenUpdateTransaction,
  ContractExecuteTransaction,
  TokenInfoQuery,
  AccountBalanceQuery,
  Hbar,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);
const aliceId = AccountId.fromString(process.env.ALICE_ID);
const aliceKey = PrivateKey.fromString(process.env.ALICE_PVKEY);
const NFTAddress = AccountId.fromString(process.env.NFTADDR);
const TokenAddress = AccountId.fromString(process.env.TOKENADDR);
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

///////////////////////////
const adminAddr = treasuryId.toSolidityAddress();
const tokenAddr = TokenAddress.toSolidityAddress();
const NFTAddr = NFTAddress.toSolidityAddress();

async function main() {
  // STEP 1 ===================================
  console.log(`STEP 1 ===================================`);
  const bytecode = fs.readFileSync(
    "./Contracts_ZarelBorrowingContract_sol_ZarelBorrow.bin"
  );
  console.log(`- Done \n`);

  // STEP 2 ===================================
  console.log(`STEP 2 ===================================`);

  //Create a file on Hedera and store the contract bytecode
  const fileCreateTx = new FileCreateTransaction()
    .setKeys([treasuryKey])
    .freezeWith(client);
  const fileCreateSign = await fileCreateTx.sign(treasuryKey);
  const fileCreateSubmit = await fileCreateSign.execute(client);
  const fileCreateRx = await fileCreateSubmit.getReceipt(client);
  const bytecodeFileId = fileCreateRx.fileId;
  console.log(`- The smart contract bytecode file ID is ${bytecodeFileId}`);

  // Append contents to the file
  const fileAppendTx = new FileAppendTransaction()
    .setFileId(bytecodeFileId)
    .setContents(bytecode)
    .setMaxChunks(10)
    .freezeWith(client);
  const fileAppendSign = await fileAppendTx.sign(treasuryKey);
  const fileAppendSubmit = await fileAppendSign.execute(client);
  const fileAppendRx = await fileAppendSubmit.getReceipt(client);
  console.log(`- Content added: ${fileAppendRx.status} \n`);

  // STEP 3 ===================================
  console.log(`STEP 3 ===================================`);
  // Create the smart contract
  const contractInstantiateTx = new ContractCreateTransaction()
    .setBytecodeFileId(bytecodeFileId)
    .setGas(3000000)
    .setAdminKey(treasuryKey)
    .setConstructorParameters(
      new ContractFunctionParameters()
        .addAddress(adminAddr)
        .addAddress(tokenAddr)
        .addAddress(NFTAddr)
        .addAddress(NFTAddr)
        .addAddress(tokenAddr)
    )
    .freezeWith(client);
  const contractExecSign1 = await contractInstantiateTx.sign(treasuryKey);
  const contractInstantiateSubmit = await contractExecSign1.execute(client);
  const contractInstantiateRx = await contractInstantiateSubmit.getReceipt(
    client
  );
  const contractId = contractInstantiateRx.contractId;
  const contractAddress = contractId.toSolidityAddress();
  console.log(`- The smart contract ID is: ${contractId}`);
  console.log(
    `- The smart contract ID in Solidity format is: ${contractAddress} \n`
  );
  //////////////////////////////////////////
  // Associate Contract with Token
  console.log(`STEP 3b ===================================`);
  //Execute a contract function (associate)
  console.log(`ASSOCIATE TOKEN WITH CONTRACT ==================`);
  const contractExecTx1 = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction(
      "tokenAssociate",
      new ContractFunctionParameters().addAddress(tokenAddr)
    )
    .freezeWith(client);
  //   const contractExecSign1 = await contractExecTx1.sign(aliceKey);
  const contractExecSubmit1 = await contractExecTx1.execute(client);
  const contractExecRx1 = await contractExecSubmit1.getReceipt(client);
  console.log(
    `- Token association with Contract's account: ${contractExecRx1.status.toString()} \n`
  );
  //////////////////////////////////////////
  console.log(`STEP 3c ===================================`);
  //Execute a contract function (associate)
  console.log(`ASSOCIATE NFT WITH CONTRACT ==================`);
  const contractExecTx2 = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction(
      "tokenAssociate",
      new ContractFunctionParameters().addAddress(NFTAddr)
    )
    .freezeWith(client);
  //
  const contractExecSubmit2 = await contractExecTx2.execute(client);
  const contractExecRx2 = await contractExecSubmit2.getReceipt(client);
  console.log(
    `- NFT association with Contract's account: ${contractExecRx2.status.toString()} \n`
  );

  /////////////////////////////////////////////
  //////////////////////////////////////////
  //BALANCE CHECK
  var balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(treasuryId)
    .execute(client);
  console.log(
    `- Treasury balance: ${balanceCheckTx.tokens._map.get(
      TokenAddress.toString()
    )} units of token ID ${TokenAddress}`
  );
  /////////////////////////////
  // TRANSFER STABLECOIN FROM TREASURY TO CON
  let tokenTransferTx = await new TransferTransaction()
    .addTokenTransfer(TokenAddress, treasuryId, -100)
    .addTokenTransfer(TokenAddress, contractId, 100)
    .addHbarTransfer(treasuryId, Hbar.fromTinybars(-200))
    .addHbarTransfer(contractId, Hbar.fromTinybars(200))
    .freezeWith(client)
    .sign(treasuryKey);

  //SUBMIT THE TRANSACTION
  let tokenTransferSubmit = await tokenTransferTx.execute(client);

  //GET THE RECEIPT OF THE TRANSACTION
  let tokenTransferRx = await tokenTransferSubmit.getReceipt(client);

  //LOG THE TRANSACTION STATUS
  console.log(
    `\n- Stablecoin transfer from Treasury to Contract: ${tokenTransferRx.status} \n`
  );

  // BALANCE CHECK
  var balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(treasuryId)
    .execute(client);
  console.log(
    `- Treasury balance: ${balanceCheckTx.tokens._map.get(
      TokenAddress.toString()
    )} units of token ID ${TokenAddress}`
  );
  //   var balanceCheckTx = await new AccountBalanceQuery()
  //     .setAccountId(contractId)
  //     .execute(client);
  //   console.log(
  //     `- Alice's balance: ${balanceCheckTx.tokens._map.get(
  //       TokenAddress.toString()
  //     )} units of token ID ${TokenAddress}`
  //   );
  //////////////////////////////

  // STEP 4 ===================================
  console.log(`STEP 4 ===================================`);
  //Execute a contract function (setFloorPrice)
  const contractExecTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction("setFloorPrice", new ContractFunctionParameters().addInt64(50))
    .freezeWith(client);
  const contractExecSign2 = await contractExecTx.sign(treasuryKey);
  const contractExecSubmit = await contractExecSign2.execute(client);
  const contractExecRx = await contractExecSubmit.getReceipt(client);
  console.log(`- FloorPrice: ${contractExecRx.status.toString()}`);

  //Contract call query
  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction("floorPrice");

  //Sign with the client operator private key to pay for the query and submit the query to a Hedera network
  const contractCallResult = await query.execute(client);

  // Get the function value
  const message = contractCallResult.getInt64();
  console.log("contract message: " + message);

  let tB = await bCheckerFcn(treasuryId);
  let aB = await bCheckerFcn(aliceId);
  let aT = await TCheckerFcn(aliceId);
  console.log(`- Treasury balance: ${tB} units of NFT ${NFTAddress}`);
  console.log(`- Alice balance: ${aB} units of NFT ${NFTAddress} \n`);
  console.log(`- Alice balance: ${aT} units of Token ${TokenAddress} \n`);

  // STEP 4 ===================================
  console.log(`STEP 5 ===================================`);
  // Execute a contract function (Borrow)
  const contractBorrowTx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction(
      "Borrow",
      new ContractFunctionParameters()
        .addAddress(aliceId.toSolidityAddress())
        .addInt64(1)
    )
    .freezeWith(client)
    .sign(aliceKey);
  const contractExecSign3 = await contractBorrowTx.sign(aliceKey);
  const contractBorrowSubmit = await contractExecSign3.execute(client);
  const contractBorrowRx = await contractBorrowSubmit.getReceipt(client);
  console.log(`- Borrow: ${contractBorrowRx.status.toString()}`);

  tB = await bCheckerFcn(treasuryId);
  aB = await bCheckerFcn(aliceId);
  aT = await TCheckerFcn(aliceId);
  console.log(`- Treasury balance: ${tB} units of NFT ${NFTAddress}`);
  console.log(`- Alice balance: ${aB} units of NFT ${NFTAddress} \n`);
  console.log(`- Alice balance: ${aT} units of Token ${TokenAddress} \n`);

  const contractBorrowTx2 = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction("getNFts", new ContractFunctionParameters().addInt64(1))
    .freezeWith(client)
    .sign(treasuryKey);
  const contractExecSign4 = await contractBorrowTx2.sign(treasuryKey);
  const contractBorrowSubmit2 = await contractExecSign4.execute(client);
  const contractBorrowRx2 = await contractBorrowSubmit2.getReceipt(client);
  console.log(`- Borrow: ${contractBorrowRx2.status.toString()}`);

  tB = await bCheckerFcn(treasuryId);
  console.log(`- Treasury balance: ${tB} units of NFT ${NFTAddress}`);
}

// ========================================
// FUNCTIONS
async function bCheckerFcn(aId) {
  let balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(aId)
    .execute(client);
  return balanceCheckTx.tokens._map.get(NFTAddress.toString());
}

async function TCheckerFcn(aId) {
  let balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(aId)
    .execute(client);
  return balanceCheckTx.tokens._map.get(TokenAddress.toString());
}

main();
