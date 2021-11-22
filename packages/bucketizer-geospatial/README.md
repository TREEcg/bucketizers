# LDES Geospatial Bucketizer
[![npm](https://img.shields.io/npm/v/@treecg/geospatial-bucketizer)](https://www.npmjs.com/package/@treecg/geospatial-bucketizer)

The purpose of the geospatial bucketizer is to apply a geospatial fragmentation to LDES members, based on a property path.

> An LDES bucketizer adds triples with the ldes bucket predicate (https://w3id.org/ldes#bucket)[https://w3id.org/ldes#bucket] to the array of quads representating an LDES member, indicating the bucket in which the member belongs.

The fragmentation strategy converts the geospatial string to a GeoJson object, which is used to determine in which tile(s) the LDES member is present and adds these values `{zoom}/{x}/{y}` to the bucket triples. **At the moment only wkt literals are supported**.
The hypermedia controls are stored in a map. There is a root, which contains relation to one or more intermediate root files, the columns (X). Each of these root files, then contains relation to the tiles that contain the actual LDES members

## Example

We assume the following LDES member on which we apply a geospatial fragmentation, using the property path `<http://www.w3.org/ns/dcat#bbox>` and zoom level set to 4.
```ttl
<http://example.ord/id/123@456> dct:created "2002-08-13T16:33:18+02:00"^^xsd:dateTime ;
          dct:isVersionOf <http://example.org/id/123> ;
          prov:generatedAtTime "2021-09-07T15:44:05.975Z"^^xsd:dateTime ;
          dcat:bbox "Polygon((-63.37716 45.97597,-71.05923 45.97597,-71.05923 41.65926,-63.37716 41.65926,-63.37716 45.97597))"^^gsp:wktLiteral ;
          rdfs:label "Random place" .
```

After passing through the bucketizer, the LDES member will have one or more triples:
```ttl
<http://example.ord/id/123@456> dct:created "2002-08-13T16:33:18+02:00"^^xsd:dateTime ;
          dct:isVersionOf <http://example.org/id/123> ;
          prov:generatedAtTime "2021-09-07T15:44:05.975Z"^^xsd:dateTime ;
          dcat:bbox "Polygon((-63.37716 45.97597,-71.05923 45.97597,-71.05923 41.65926,-63.37716 41.65926,-63.37716 45.97597))"^^gsp:wktLiteral ;
          rdfs:label "Random place" ;
          ldes:bucket "4/0/1", "4/0/2" .
```

## Install

```
> npm install @treecg/geospatial-bucketizer
```

## Usage

A bucketizer should always be used in combination with the LDES client. More information on how to setup an LDES client can be found [here](https://github.com/TREEcg/event-stream-client/tree/main/packages/actor-init-ldes-client). It is important to set the option in the LDES client to receive the LDES member as an array of quads: `representation: 'quads'`.

The bucketizer expects a valid property path.

```
import { GeospatialBucketizer } from '@treecg/geospatial-bucketizer';

const run = async (): Promise<void> => {
  const options = {...};
  const url = ...;
  const zoomLevel = ...;

  const bucketizer = await GeospatialBucketizer.build({propertyPath: '<http://www.w3.org/2000/01/rdf-schema#label>'}, zoomLevel);

  const ldes = LDESClient.createReadStream(url, options);
  ldes.on('data', (member) => {
    bucketizer.bucketize(member.quads, member.id)

    // Continue processing the member, but now the array of quads will have extra triples, the bucket triples
  });
}

run().catch(error => console.error(error.stack));
```
