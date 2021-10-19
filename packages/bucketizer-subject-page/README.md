# LDES Subject Page Bucketizer

The purpose of the subject page bucketizer is to fragment the LDES members based on their versionOfPath. This bucketizer assumes URIs comply with the following structure: `http(s)://{domain}/{type}/{concept}(/{reference})*`, e.g. `https://data.vlaanderen.be/id/gemeente/44001`. As the `{reference}` represents the identifier of the object, this part is used to indicate the bucket.

> An LDES bucketizer adds triples with the ldes bucket predicate (https://w3id.org/ldes#bucket) to the array of quads representating an LDES member, indicating the bucket in which the member belongs.

## Example

Assume the following member:

```ttl
<http://example.ord/id/123@456> dct:created "2002-08-13T16:33:18+02:00"^^xsd:dateTime ;
          dct:isVersionOf <http://example.org/id/123> ;
          prov:generatedAtTime "2021-09-07T15:44:05.975Z"^^xsd:dateTime .
``` 

After passing the subject page bucketizer, the member will have an extra triple:
```ttl
<http://example.ord/id/123@456> dct:created "2002-08-13T16:33:18+02:00"^^xsd:dateTime ;
          dct:isVersionOf <http://example.org/id/123> ;
          prov:generatedAtTime "2021-09-07T15:44:05.975Z"^^xsd:dateTime ;
          ldes:bucket "123"^^xsd:string .
```

## Install

```bash
> npm i @treecg/ldes-subject-page-bucketizer
```

## Usage

A bucketizer should always be used in combination with the LDES client. More information on how to setup an LDES client can be found [here](https://github.com/TREEcg/event-stream-client/tree/main/packages/actor-init-ldes-client). It is important to set the option in the LDES client to receive the LDES member as an array of quads: `representation: 'quads'`.

The bucketizer expects a property path as input and should have the following structure `(<predicate1> <predicate2> ...)`

```
import { SubjectPageBucketizer } from '@treecg/ldes-subject-page-bucketizer'

const run = async (): Promise<void> => {
  const options = {...};
  const url = ...;

  const bucketizer = await SubjectPageBucketizer.build('(<http://purl.org/dc/terms/isVersionOf>)');

  const ldes = LDESClient.createReadStream(url, options);
  ldes.on('data', (member) => {
    bucketizer.bucketize(member.quads, member.id)
    
    // Continue processing the member, but now the array of quads will have an extra triple, the bucket triple
  });
}

run().catch(error => console.error(error.stack));
```
