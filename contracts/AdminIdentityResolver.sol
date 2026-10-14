// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

struct Attestation {
 bytes32 uid; bytes32 schema; uint64 time; uint64 expirationTime; uint64 revocationTime;
 bytes32 refUID; address recipient; address attester; bool revocable; bytes data;
}

/// @notice Restricts EAS attestations to New Tibet's configured administrator.
/// No names, book numbers, images or hashes of identity documents belong onchain.
contract AdminIdentityResolver {
 address public immutable admin;
 address public immutable eas;
 error Unauthorized();
 error InvalidIdentity();
 error NoPayments();
 constructor(address easAddress,address adminAddress) {
  require(easAddress!=address(0)&&adminAddress!=address(0));
  eas=easAddress;admin=adminAddress;
 }
 modifier onlyEAS(){if(msg.sender!=eas)revert Unauthorized();_;}
 function isPayable() external pure returns(bool){return false;}
 function attest(Attestation calldata a,uint256 value) external payable onlyEAS returns(bool){
  if(value!=0||msg.value!=0)revert NoPayments();return validate(a);
 }
 function revoke(Attestation calldata a,uint256 value) external payable onlyEAS returns(bool){
  if(value!=0||msg.value!=0)revert NoPayments();if(a.attester!=admin)revert Unauthorized();return true;
 }
 function multiAttest(Attestation[] calldata list,uint256[] calldata values) external payable onlyEAS returns(bool){
  if(list.length!=values.length)revert InvalidIdentity();if(msg.value!=0)revert NoPayments();
  for(uint256 i;i<list.length;i++){if(values[i]!=0)revert NoPayments();validate(list[i]);}return true;
 }
 function multiRevoke(Attestation[] calldata list,uint256[] calldata values) external payable onlyEAS returns(bool){
  if(list.length!=values.length)revert InvalidIdentity();if(msg.value!=0)revert NoPayments();
  for(uint256 i;i<list.length;i++){if(values[i]!=0)revert NoPayments();if(list[i].attester!=admin)revert Unauthorized();}return true;
 }
 function validate(Attestation calldata a) internal view returns(bool){
  if(a.attester!=admin)revert Unauthorized();
  if(a.recipient==address(0)||!a.revocable||a.expirationTime<=block.timestamp||a.data.length!=96)revert InvalidIdentity();
  (bytes32 memberReference,bool verified,uint8 version)=abi.decode(a.data,(bytes32,bool,uint8));
  if(memberReference==bytes32(0)||!verified||version!=1)revert InvalidIdentity();return true;
 }
}
