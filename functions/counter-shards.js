'use strict';
const {createHash}=require('node:crypto');

const COUNTER_SHARDS=64;

/**
 * Deterministic, evenly distributed shard selection.
 * Using the Firebase anonymous auth UID means retries for the same signer
 * always target the same shard; the signature transaction remains idempotent.
 */
function shardForUid(uid){
 if(typeof uid!=='string'||!uid)throw new TypeError('A valid auth UID is required');
 return createHash('sha256').update(uid).digest().readUInt16BE(0)%COUNTER_SHARDS;
}

module.exports={COUNTER_SHARDS,shardForUid};
