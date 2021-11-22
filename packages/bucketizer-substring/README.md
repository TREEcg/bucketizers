# LDES Substring Bucketizer
[![npm](https://img.shields.io/npm/v/@treecg/substring-bucketizer)](https://www.npmjs.com/package/@treecg/substring-bucketizer)

The purpose of the substring bucketizer is to apply a substring fragmentation tot LDES members based on a property path.

> An LDES bucketizer adds triples with the ldes bucket predicate (https://w3id.org/ldes#bucket) to the array of quads representating an LDES member, indicating the bucket in which the member belongs.

The fragmentation strategy is based on [previous work](https://github.com/TREEcg/substring_fragmenter) and the following method is applied:
![Fragmentation Strategy](https://raw.githubusercontent.com/TREEcg/substring_fragmenter/main/img/files.svg)

## Example

We assume the following LDES member on which a substring fragmentation with the property path set to `(<http://www.w3.org/2000/01/rdf-schema#label>)` will be applied.

```ttl
<http://example.ord/id/123@456> dct:created "2002-08-13T16:33:18+02:00"^^xsd:dateTime ;
          dct:isVersionOf <http://example.org/id/123> ;
          prov:generatedAtTime "2021-09-07T15:44:05.975Z"^^xsd:dateTime ;
          rdfs:label "John Doe" .
```

After passing through the bucketizer, the LDES member will have one or more extra triples
```ttl
<http://example.ord/id/123@456> dct:created "2002-08-13T16:33:18+02:00"^^xsd:dateTime ;
          dct:isVersionOf <http://example.org/id/123> ;
          prov:generatedAtTime "2021-09-07T15:44:05.975Z"^^xsd:dateTime ;
          rdfs:label "John Doe" ;
          ldes:bucket "j"
```

Depending on when this LDES member is processed, it is possible for it to have a different bucket


## Install

```bash
> npm i @treecg/ldes-substring-bucketizer
```

## Usage

A bucketizer should always be used in combination with the LDES client. More information on how to setup an LDES client can be found [here](https://github.com/TREEcg/event-stream-client/tree/main/packages/actor-init-ldes-client). It is important to set the option in the LDES client to receive the LDES member as an array of quads: `representation: 'quads'`.

The bucketizer expects a property path as input and should have the following structure `(<predicate1> <predicate2> ...)`

```
import { SubstringBucketzer } from '@treecg/substring-bucketizer'

const run = async (): Promise<void> => {
  const options = {...};
  const url = ...;
  const pageSize: ...;

  const bucketizer = await SubstringBucketizer.build({ propertyPath: '<http://www.w3.org/2000/01/rdf-schema#label>', pageSize: pageSize });

  const ldes = LDESClient.createReadStream(url, options);
  ldes.on('data', (member) => {
    bucketizer.bucketize(member.quads, member.id)

    // Continue processing the member, but now the array of quads will have extra triples, the bucket triples
  });
}

run().catch(error => console.error(error.stack));
```
