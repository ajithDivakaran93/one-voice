'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {COUNTER_SHARDS,shardForUid}=require('./counter-shards');

test('shard assignment is deterministic and never exceeds shard range',()=>{
 assert.equal(COUNTER_SHARDS,64);
 assert.equal(shardForUid('same-user'),shardForUid('same-user'));
 assert.throws(()=>shardForUid(''),TypeError);
 for(let i=0;i<10000;i++){
  const shard=shardForUid('campaign-signer-'+i);
  assert.ok(Number.isInteger(shard));
  assert.ok(shard>=0&&shard<COUNTER_SHARDS);
 }
});

test('10,000 distinct signers distribute across every shard',()=>{
 const histogram=Array(COUNTER_SHARDS).fill(0);
 for(let i=0;i<10000;i++)histogram[shardForUid('campaign-signer-'+i)]++;
 assert.equal(histogram.reduce((sum,n)=>sum+n,0),10000);
 assert.ok(histogram.every(n=>n>80),`Unexpected distribution: ${histogram.join(',')}`);
});
