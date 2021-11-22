# LDES Basic Bucketizer
[![npm](https://img.shields.io/npm/v/@treecg/basic-bucketizer)](https://www.npmjs.com/package/@treecg/basic-bucketizer)

The purpose of the basic bucketizer is to fragment the LDES members based on the order they were received. **This bucketizer must be used as a fallback bucketizer in case when no fragmentation strategy was chosen.**

> An LDES bucketizer adds triples with the ldes bucket predicate (https://w3id.org/ldes#bucket) to the array of quads representating an LDES member, indicating the bucket in which the member belongs.

This strategy will create a file called `0.ttl` where the first LDES member will be added to, once the page limit is received, a new file, `1.ttl`, is created to add LDES members to.

## Install

```bash
> npm i @treecg/basic-bucketizer
```

## Usage

```
import { BasicBucketizer } from '@treecg/basic-bucketizer'

const run = async (): Promise<void> => {
  const options = {...};
  const url = ...;
  const pageSize = 50;

  const bucketizer = await BasicBucketizer.build({pageSize: pageSize});

  const ldes = LDESClient.createReadStream(url, options);
  ldes.on('data', (member) => {
    bucketizer.bucketize(member.quads, member.id)

    // Continue processing the member, but now the array of quads will have an extra triple, the bucket triple
  });
}

run().catch(error => console.error(error.stack));
```